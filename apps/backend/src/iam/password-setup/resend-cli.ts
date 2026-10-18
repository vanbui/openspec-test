import type { Core } from "@strapi/strapi";
import { markAdministrationBoot } from "../../bootstrap/boot-mode";
import { readKeycloakProvisioningConfig } from "../../keycloak/config";
import { resendPasswordSetupEmail, type PasswordSetupResult } from "./service";

type CliBackend = { load(): Promise<unknown>; destroy(): Promise<void> };
export type PasswordSetupCliDependencies = {
  configure(): void;
  createBackend(): Promise<CliBackend>;
  resend(backend: CliBackend, documentId: string): Promise<PasswordSetupResult>;
  output(line: string): void;
  cleanupTimeoutMs?: number;
  cleanupFailed?(): void;
};

export function parsePasswordSetupCliArgs(args: string[]): string {
  const values = args[0] === "--" ? args.slice(1) : args;
  if (values.length !== 1 || !/^[a-z0-9]{24}$/.test(values[0])) throw new Error("PASSWORD_SETUP_USAGE");
  return values[0];
}

const reasons = new Set(["accepted", "ineligible", "unavailable", "timeout", "scheduling", "registration", "shutdown", "disabled", "configuration"]);
function closedResult(result: PasswordSetupResult): string {
  if (!["sent", "failed", "skipped"].includes(result.outcome) || !reasons.has(result.reason)) {
    return "Password setup command failed (unavailable).\n";
  }
  return `Password setup command ${result.outcome} (${result.reason}).\n`;
}

/** Boot without a listener, attempt once, and always bound resource cleanup. */
export async function runPasswordSetupCli(args: string[], dependencies: PasswordSetupCliDependencies): Promise<number> {
  let backend: CliBackend | undefined;
  let status = 1;
  let stage = "usage";
  const output = (line: string) => { try { dependencies.output(line); } catch { status = 1; } };
  try {
    const documentId = parsePasswordSetupCliArgs(args);
    stage = "configuration";
    dependencies.configure();
    stage = "boot";
    backend = await dependencies.createBackend();
    await backend.load();
    stage = "unavailable";
    const result = await dependencies.resend(backend, documentId);
    status = result.outcome === "sent" && result.reason === "accepted" ? 0 : 1;
    output(closedResult(result));
  } catch { output(`Password setup command failed (${stage}).\n`); }
  finally {
    if (backend) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.resolve().then(() => backend!.destroy()),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error("PASSWORD_SETUP_CLEANUP")),
              Math.min(2000, Math.max(1, dependencies.cleanupTimeoutMs ?? 2000)));
          }),
        ]);
      } catch {
        status = 1; output("Password setup command failed (cleanup).\n");
        try { dependencies.cleanupFailed?.(); } catch { /* The command still returns its closed failure. */ }
      }
      finally { clearTimeout(timer); }
    }
  }
  return status;
}

type BackendRuntime = Pick<typeof import("@strapi/strapi"), "compileStrapi" | "createStrapi">;
export function createPasswordSetupCliDependencies(runtime: BackendRuntime, appDir: string,
  env: Record<string, string | undefined> = process.env): PasswordSetupCliDependencies {
  const dependencies: PasswordSetupCliDependencies = {
    configure() {
      if (!readKeycloakProvisioningConfig(env)) throw new Error("PASSWORD_SETUP_DISABLED");
    },
    async createBackend() {
      markAdministrationBoot();
      const compiled = await runtime.compileStrapi({ appDir });
      return runtime.createStrapi({ appDir, distDir: compiled.distDir });
    },
    resend: (backend, documentId) => resendPasswordSetupEmail(backend as Core.Strapi, documentId,
      { env, log: event => dependencies.output(`${event}\n`) }),
    output: line => { process.stdout.write(line); },
  };
  return dependencies;
}

export async function main(args: string[] = process.argv.slice(2),
  createDependencies: () => PasswordSetupCliDependencies = () => createPasswordSetupCliDependencies(require("@strapi/strapi"), process.cwd()),
  terminate: (status: number) => void = status => process.exit(status)): Promise<void> {
  // Reject selectors before loading framework configuration or application modules.
  try { parsePasswordSetupCliArgs(args); }
  catch { process.stderr.write("Password setup command failed (usage).\n"); process.exitCode = 1; return; }
  const stdout = process.stdout.write;
  const stderr = process.stderr.write;
  const write = stdout.bind(process.stdout);
  // Application boot diagnostics may contain remote details. Publish only the closed command result.
  process.stdout.write = (() => true) as typeof process.stdout.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  let cleanupFailed = false;
  try {
    const dependencies = createDependencies();
    dependencies.cleanupFailed = () => { cleanupFailed = true; };
    dependencies.output = line => { write(line); };
    process.exitCode = await runPasswordSetupCli(args, dependencies);
  } catch { write("Password setup command failed (boot).\n"); process.exitCode = 1; }
  finally { process.stdout.write = stdout; process.stderr.write = stderr; }
  // A failed destroy may retain database handles. Only the command entrypoint may terminate the process.
  if (cleanupFailed) await new Promise<void>(resolve => setTimeout(() => { terminate(1); resolve(); }, 100));
}
if (require.main === module) void main().catch(() => { process.exitCode = 1; });
