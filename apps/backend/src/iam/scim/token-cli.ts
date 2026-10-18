import path from "node:path";
import type { Core } from "@strapi/strapi";
import { administerSourceToken, hashSourceToken, parseSourceToken, type SourceTokenAction, type SourceTokenResult } from "./token-service";
import { withSourceLock } from "./source-lock";
import { resolveSourcePrincipal } from "../identity/source-principal";
import { writeDevelopmentToken } from "./dev-token-export";
import { markAdministrationBoot } from "../../bootstrap/boot-mode";

const SOURCE = "api::identity-source.identity-source";
type IssuedToken = Extract<SourceTokenResult, { token: string }>;
type CliBackend = { load(): Promise<unknown>; destroy(): Promise<void> };
const failureCodes = new Set([
  "IAM_SCIM_TOKEN_USAGE", "IAM_SCIM_TOKEN_INVALID_ACTION", "IAM_SCIM_TOKEN_PRECONDITION", "IAM_SCIM_TOKEN_OUTPUT_FAILED",
  "IAM_SCIM_SOURCE_NOT_FOUND", "IAM_SCIM_SOURCE_AMBIGUOUS", "IAM_SCIM_SOURCE_CHANGED", "IAM_SCIM_SOURCE_INVALID_BINDING",
  "IAM_SCIM_SOURCE_INVALID_DOCUMENT_ID", "IAM_SCIM_SOURCE_LOCK_METADATA_MISSING", "IAM_SCIM_SOURCE_LOCK_UNSUPPORTED_DATABASE",
  "IAM_SCIM_DEV_SOURCE_REQUIRED", "IAM_SCIM_DEV_EXPORT_FAILED", "IAM_SCIM_DEV_EXPORT_UNSUPPORTED_PLATFORM",
]);
const failureHints: Record<string, string> = {
  IAM_SCIM_DEV_EXPORT_UNSUPPORTED_PLATFORM: "--write-dev-env needs POSIX owner-only file permissions, which Windows does not have. "
    + "Run the command from WSL or a Linux container, or omit --write-dev-env and put the printed token in docker/.env yourself.\n",
};
export function tokenCliFailureMessage(error: unknown): string {
  const code = error instanceof Error && failureCodes.has(error.message) ? error.message : "IAM_SCIM_UNEXPECTED";
  return `SCIM token command failed (${code}). Usage: scim:token <source> [issue|rotate|revoke] [--write-dev-env].\n${failureHints[code] ?? ""}`;
}
export type TokenCliDependencies = {
  createBackend(): Promise<CliBackend>;
  administer(backend: CliBackend, selector: string, action?: SourceTokenAction): Promise<SourceTokenResult>;
  validateExport(backend: CliBackend, selector: string): Promise<void>;
  exportToken(backend: CliBackend, result: IssuedToken): Promise<void>;
  revokeUndelivered(backend: CliBackend, result: IssuedToken): Promise<void>;
  stdout(line: string): Promise<void>;
  stderr(line: string): void;
};

export function parseTokenCliArgs(args: string[]) {
  const [source, ...rest] = args;
  if (!source || source.startsWith("-") || parseSourceToken(source) || rest.length > 2) throw new Error("IAM_SCIM_TOKEN_USAGE");
  let action: SourceTokenAction | undefined;
  let writeDevEnv = false;
  for (const argument of rest) {
    if (argument === "--write-dev-env" && !writeDevEnv) writeDevEnv = true;
    else if (["issue", "rotate", "revoke"].includes(argument) && action === undefined && !writeDevEnv) action = argument as SourceTokenAction;
    else throw new Error("IAM_SCIM_TOKEN_USAGE");
  }
  if (action === "revoke" && writeDevEnv) throw new Error("IAM_SCIM_TOKEN_USAGE");
  return { source, action, writeDevEnv };
}

/**
 * The development export trusts only an owner-only docker/ directory and file (writeDevelopmentToken), which Windows
 * cannot express: every directory there reports group and other write bits. Refuse before boot, so no token is issued
 * and then revoked, instead of failing late with IAM_SCIM_DEV_EXPORT_FAILED.
 */
export function assertDevExportPlatform(options: { writeDevEnv: boolean }, platform: NodeJS.Platform = process.platform): void {
  if (options.writeDevEnv && platform === "win32") throw new Error("IAM_SCIM_DEV_EXPORT_UNSUPPORTED_PLATFORM");
}

/** Read-only validation of the seeded registration; never seed, repair or grant here. */
export async function assertDevelopmentSource(strapi: Core.Strapi, documentId: string, environment: string | undefined) {
  if (environment !== "development") throw new Error("IAM_SCIM_DEV_SOURCE_REQUIRED");
  const source = await strapi.documents(SOURCE).findOne({ documentId, populate: { serviceUser: true } });
  const user = source?.serviceUser;
  if (!source || source.name !== "midPoint (dev)" || user?.username !== "midpoint-dev-provisioning"
    || user.email !== "midpoint-dev-provisioning@idambox.test" || user.displayName !== "midPoint (dev) provisioning"
    || !await resolveSourcePrincipal(strapi, documentId)) throw new Error("IAM_SCIM_DEV_SOURCE_REQUIRED");
}

/** Revoke only the failed delivery, never a later concurrent rotation. */
export async function revokeUndeliveredToken(strapi: Core.Strapi, result: IssuedToken) {
  await withSourceLock(strapi, result.sourceDocumentId, async () => {
    const source = await strapi.documents(SOURCE).findOne({ documentId: result.sourceDocumentId });
    if (source?.tokenHash === hashSourceToken(result.token)) {
      await administerSourceToken(strapi, result.sourceDocumentId, "revoke");
    }
  });
}

export async function runTokenCli(args: string[], dependencies: TokenCliDependencies): Promise<number> {
  let backend: CliBackend | undefined;
  let pending: IssuedToken | undefined;
  let status = 0;
  try {
    const options = parseTokenCliArgs(args);
    backend = await dependencies.createBackend();
    await backend.load();
    if (options.writeDevEnv) await dependencies.validateExport(backend, options.source);
    const result = await dependencies.administer(backend, options.source, options.action);
    if (result.action === "revoke") await dependencies.stdout("SCIM token revoked.\n");
    else {
      pending = result;
      if (options.writeDevEnv) await dependencies.exportToken(backend, result);
      await dependencies.stdout(`${result.token}\n`);
      pending = undefined;
    }
  } catch (error) {
    status = 1;
    if (backend && pending) {
      try { await dependencies.revokeUndelivered(backend, pending); }
      catch { dependencies.stderr("SCIM token delivery failed; revocation could not be confirmed. Revoke the source token before retrying.\n"); }
    }
    dependencies.stderr(tokenCliFailureMessage(error));
  } finally {
    if (backend) {
      try { await backend.destroy(); }
      catch { status = 1; dependencies.stderr("SCIM token backend cleanup failed (IAM_SCIM_UNEXPECTED).\n"); }
    }
  }
  return status;
}

type BackendRuntime = Pick<typeof import("@strapi/strapi"), "compileStrapi" | "createStrapi">;
export function createTokenCliDependencies(runtime: BackendRuntime, appDir: string): TokenCliDependencies {
  return {
    createBackend: async () => {
      const compiled = await runtime.compileStrapi({ appDir });
      return runtime.createStrapi({ appDir, distDir: compiled.distDir });
    },
    administer: (backend, selector, action) => administerSourceToken(backend as Core.Strapi, selector, action),
    validateExport: async (backend, selector) => {
      if (process.env.NODE_ENV !== "development") throw new Error("IAM_SCIM_DEV_SOURCE_REQUIRED");
      const strapi = backend as Core.Strapi;
      const exact = await strapi.documents(SOURCE).findOne({ documentId: selector });
      if (exact) {
        await assertDevelopmentSource(strapi, exact.documentId, process.env.NODE_ENV);
        return;
      }
      const matches = await strapi.documents(SOURCE).findMany({ filters: { name: { $eq: selector } }, limit: 2 });
      if (matches.length !== 1 || matches[0].name !== selector) throw new Error("IAM_SCIM_DEV_SOURCE_REQUIRED");
      await assertDevelopmentSource(strapi, matches[0].documentId, process.env.NODE_ENV);
    },
    exportToken: async (backend, result) => {
      await assertDevelopmentSource(backend as Core.Strapi, result.sourceDocumentId, process.env.NODE_ENV);
      await writeDevelopmentToken(result.token, { repositoryRoot: path.resolve(appDir, "../..") });
    },
    revokeUndelivered: (backend, result) => revokeUndeliveredToken(backend as Core.Strapi, result),
    stdout: (line) => new Promise<void>((resolve, reject) => {
      process.stdout.write(line, (error) => error ? reject(new Error("IAM_SCIM_TOKEN_OUTPUT_FAILED")) : resolve());
    }),
    stderr: (line) => { process.stderr.write(line); },
  };
}

export async function main() {
  // Reject malformed invocation before loading the backend or its configuration.
  try { assertDevExportPlatform(parseTokenCliArgs(process.argv.slice(2))); }
  catch (error) { process.stderr.write(tokenCliFailureMessage(error)); process.exitCode = 1; return; }
  // Seeds, fixtures and workers would race a running server's database; the command needs none of them.
  markAdministrationBoot();
  // Strapi logs to stdout while booting. Keep stdout for the one token line so it can be piped safely.
  const tokenOutput = process.stdout.write.bind(process.stdout);
  process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write;
  const dependencies = createTokenCliDependencies(require("@strapi/strapi"), process.cwd());
  dependencies.stdout = (line) => new Promise<void>((resolve, reject) => {
    tokenOutput(line, (error) => error ? reject(new Error("IAM_SCIM_TOKEN_OUTPUT_FAILED")) : resolve());
  });
  process.exitCode = await runTokenCli(process.argv.slice(2), dependencies);
}
if (require.main === module) void main().catch((error: unknown) => { process.stderr.write(tokenCliFailureMessage(error)); process.exitCode = 1; });
