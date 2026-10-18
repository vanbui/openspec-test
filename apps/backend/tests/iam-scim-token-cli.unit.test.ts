import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { Core } from "@strapi/strapi";
import { hashSourceToken } from "../src/iam/scim/token-service";
import { assertDevelopmentSource, assertDevExportPlatform, createTokenCliDependencies, revokeUndeliveredToken, parseTokenCliArgs, runTokenCli, tokenCliFailureMessage, type TokenCliDependencies } from "../src/iam/scim/token-cli";
import { writeDevelopmentToken, type DevTokenExportOptions } from "../src/iam/scim/dev-token-export";

// Windows keeps ACLs, not POSIX modes, and symlinks need a privilege there, so the export's owner-only checks cannot
// pass; the command refuses --write-dev-env on Windows before boot (IAM_SCIM_DEV_EXPORT_UNSUPPORTED_PLATFORM, below).
const POSIX_ONLY = process.platform === "win32" ? "POSIX modes, symlinks and hardlinks; the export refuses on Windows" : false;
const sourceDocumentId = "a".repeat(24);
const credential = () => `idb_scim_v1.${sourceDocumentId}.${randomBytes(32).toString("base64url")}`;
function harness() {
  const events: string[] = [];
  const output: string[] = [];
  const token = credential();
  const host = { load: async () => { events.push("load"); }, destroy: async () => { events.push("destroy"); } };
  const deps: TokenCliDependencies = {
    createBackend: async () => { events.push("create"); return host; },
    administer: async (_backend, selector, action) => {
      assert.equal(selector, sourceDocumentId);
      events.push(action ?? "default");
      events.push("commit");
      return action === "revoke" ? { action, sourceDocumentId, tokenRotatedAt: new Date().toISOString() }
        : { action: action ?? "issue", sourceDocumentId, token, tokenRotatedAt: new Date().toISOString() };
    },
    revokeUndelivered: async (backend, result) => { await deps.administer(backend, result.sourceDocumentId, "revoke"); },
    validateExport: async () => { events.push("preflight"); },
    exportToken: async (_backend, result) => { assert.equal(result.sourceDocumentId, sourceDocumentId); events.push("export"); },
    stdout: async (line) => { events.push("stdout"); output.push(line); },
    stderr: (line) => { events.push("stderr"); assert.equal(line.includes(token), false); },
  };
  return { deps, host, events, output, token };
}

test("exact selectors and actions, optional default and export switch; no credential arguments", () => {
  assert.deepEqual(parseTokenCliArgs(["midPoint (dev)"]), { source: "midPoint (dev)", action: undefined, writeDevEnv: false });
  for (const action of ["issue", "rotate", "revoke"] as const) {
    assert.deepEqual(parseTokenCliArgs([sourceDocumentId, action]), { source: sourceDocumentId, action, writeDevEnv: false });
  }
  assert.deepEqual(parseTokenCliArgs([sourceDocumentId, "--write-dev-env"]), { source: sourceDocumentId, action: undefined, writeDevEnv: true });
  for (const args of [[], ["--token"], [sourceDocumentId, "--token", credential()], [sourceDocumentId, credential()],
    [sourceDocumentId, "ISSUE"], [credential()], [sourceDocumentId, "--write-dev-env", "rotate"], [sourceDocumentId, "issue", "rotate"], [sourceDocumentId, "--write-dev-env", "--write-dev-env"],
    [sourceDocumentId, "revoke", "--write-dev-env"], [sourceDocumentId, "--unknown"]]) assert.throws(() => parseTokenCliArgs(args));
});

test("issue, rotate and omitted action reuse committed lifecycle and emit the secret exactly once without a listener", async () => {
  for (const action of [undefined, "issue", "rotate"] as const) {
    const h = harness();
    assert.equal(await runTokenCli([sourceDocumentId, ...(action ? [action] : [])], h.deps), 0);
    assert.deepEqual(h.output, [`${h.token}\n`]);
    assert.deepEqual(h.events, ["create", "load", action ?? "default", "commit", "stdout", "destroy"]);
  }
});

test("revoke prints only nonsecret confirmation and closes", async () => {
  const h = harness();
  assert.equal(await runTokenCli([sourceDocumentId, "revoke"], h.deps), 0);
  assert.deepEqual(h.output, ["SCIM token revoked.\n"]);
  assert.equal(h.events.at(-1), "destroy");
});

test("requested export finishes before one-time stdout", async () => {
  const h = harness();
  assert.equal(await runTokenCli([sourceDocumentId, "rotate", "--write-dev-env"], h.deps), 0);
  assert.deepEqual(h.events, ["create", "load", "preflight", "rotate", "commit", "export", "stdout", "destroy"]);
});

test("export failure revokes the newly issued credential by stable documentId and never prints it", async () => {
  const h = harness();
  h.deps.exportToken = async () => { throw new Error(h.token); };
  assert.equal(await runTokenCli([sourceDocumentId, "--write-dev-env"], h.deps), 1);
  assert.deepEqual(h.output, []);
  assert.deepEqual(h.events, ["create", "load", "preflight", "default", "commit", "revoke", "commit", "stderr", "destroy"]);
});

test("load, lifecycle, output, revoke and destroy failures stay safe and always attempt cleanup", async () => {
  for (const stage of ["load", "administer", "stdout", "revoke", "destroy"] as const) {
    const h = harness();
    if (stage === "load") h.host.load = async () => { throw new Error(h.token); };
    if (stage === "administer") h.deps.administer = async () => { throw new Error(h.token); };
    if (stage === "stdout") h.deps.stdout = async () => { throw new Error(h.token); };
    if (stage === "revoke") {
      h.deps.exportToken = async () => { throw new Error(h.token); };
      const administer = h.deps.administer;
      h.deps.administer = async (host, selector, action) => {
        if (action === "revoke") throw new Error(h.token);
        return administer(host, selector, action);
      };
    }
    if (stage === "destroy") h.host.destroy = async () => { h.events.push("destroy"); throw new Error(h.token); };
    assert.equal(await runTokenCli([sourceDocumentId, "--write-dev-env"], h.deps), 1);
    assert.ok(h.events.includes("destroy"));
    if (stage !== "destroy") assert.deepEqual(h.output, []);
  }
});

test("a failure reports only its closed IAM_SCIM code; any other message is withheld", async () => {
  for (const [message, expected] of [["IAM_SCIM_SOURCE_NOT_FOUND", "(IAM_SCIM_SOURCE_NOT_FOUND)"],
    ["SQLITE_BUSY: database is locked", "(IAM_SCIM_UNEXPECTED)"],
    ["IAM_SCIM_PRIVATE_DATA", "(IAM_SCIM_UNEXPECTED)"]] as const) {
    const h = harness();
    const lines: string[] = [];
    h.deps.stderr = (line) => { lines.push(line); };
    h.deps.administer = async () => { throw new Error(message); };
    assert.equal(await runTokenCli([sourceDocumentId], h.deps), 1);
    assert.equal(lines.length, 1);
    assert.ok(lines[0].includes(expected));
    assert.equal(lines[0].includes("SQLITE"), false);
  }
});

test("entrypoint usage and unhandled diagnostics emit finite closed codes without boot or payloads", () => {
  const child = spawnSync(process.execPath, [path.resolve(__dirname, "../src/iam/scim/token-cli.js")], {
    encoding: "utf8", timeout: 5000,
  });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, "");
  assert.equal(child.stderr, tokenCliFailureMessage(new Error("IAM_SCIM_TOKEN_USAGE")));
  for (const error of [new Error(credential()), new Error("IAM_SCIM_PRIVATE_DATA"), { message: "IAM_SCIM_SOURCE_NOT_FOUND" }]) {
    assert.equal(tokenCliFailureMessage(error), tokenCliFailureMessage(new Error("IAM_SCIM_UNEXPECTED")));
  }
  assert.match(tokenCliFailureMessage(new Error("IAM_SCIM_SOURCE_NOT_FOUND")), /\(IAM_SCIM_SOURCE_NOT_FOUND\)/);
});

test("administration boot skips seeds, fixtures and workers after the identity invariants", async () => {
  const source = await fs.readFile(path.join(__dirname, "../../../src/index.ts"), "utf8").catch(() =>
    fs.readFile(path.join(process.cwd(), "src/index.ts"), "utf8"));
  const bootstrap = source.slice(source.indexOf("async bootstrap("));
  const guard = bootstrap.indexOf("if (isAdministrationBoot()) return;");
  assert.ok(guard > bootstrap.indexOf("ensureIdentityDatabaseInvariants(strapi)"));
  assert.ok(guard > bootstrap.indexOf("disableUsersPermissionsRegistration(strapi)"));
  for (const step of ["seedCoreData(strapi)", "seedCsrmData(strapi)", "seedIamData(strapi)", "startKeycloakSyncWorker(strapi)", "startAttachmentRescans(strapi)"]) {
    assert.ok(bootstrap.indexOf(step) > guard, `${step} runs after the administration-boot guard`);
  }
});

test("invalid arguments refuse before boot", async () => {
  const h = harness();
  assert.equal(await runTokenCli([sourceDocumentId, "--password=forbidden"], h.deps), 1);
  assert.deepEqual(h.events, ["stderr"]);
});

test("the development export refuses on Windows before boot, with a named and actionable reason", () => {
  assert.throws(() => assertDevExportPlatform({ writeDevEnv: true }, "win32"), /^Error: IAM_SCIM_DEV_EXPORT_UNSUPPORTED_PLATFORM$/);
  assert.doesNotThrow(() => assertDevExportPlatform({ writeDevEnv: false }, "win32"));
  for (const platform of ["linux", "darwin"] as const) assert.doesNotThrow(() => assertDevExportPlatform({ writeDevEnv: true }, platform));
  const message = tokenCliFailureMessage(new Error("IAM_SCIM_DEV_EXPORT_UNSUPPORTED_PLATFORM"));
  assert.match(message, /\(IAM_SCIM_DEV_EXPORT_UNSUPPORTED_PLATFORM\)/);
  assert.match(message, /WSL or a Linux container/);
  assert.doesNotMatch(tokenCliFailureMessage(new Error("IAM_SCIM_DEV_EXPORT_FAILED")), /WSL/);
});

async function fixture(work: (root: string, options: DevTokenExportOptions) => Promise<void>) {
  // Every destination is transient; never open the checkout's docker/.env.
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "iam-token-cli-")));
  try {
    execFileSync("git", ["init", "--quiet", root]);
    await fs.mkdir(path.join(root, "docker"));
    await fs.writeFile(path.join(root, ".gitignore"), "docker/.env\ndocker/.env.scim-*\n");
    await work(root, { repositoryRoot: root });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test("atomic upsert preserves unrelated bytes, replaces duplicate assignments and restricts permissions", { skip: POSIX_ONLY }, async () => {
  await fixture(async (root, options) => {
    const file = path.join(root, "docker/.env");
    await fs.writeFile(file, "# settings\r\nOTHER=literal value\r\nMIDPOINT_SCIM_TOKEN=old\r\nexport MIDPOINT_SCIM_TOKEN=duplicate\r\nTAIL=x", { mode: 0o644 });
    const token = credential();
    await writeDevelopmentToken(token, options);
    assert.equal(await fs.readFile(file, "utf8"), `# settings\r\nOTHER=literal value\r\nMIDPOINT_SCIM_TOKEN=${token}\r\nTAIL=x`);
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    assert.deepEqual(await fs.readdir(path.dirname(file)), [".env"]);
  });
});

test("creates missing ignored destination with owner-only permissions", { skip: POSIX_ONLY }, async () => {
  await fixture(async (root, options) => {
    const token = credential();
    await writeDevelopmentToken(token, options);
    assert.equal(await fs.readFile(path.join(root, "docker/.env"), "utf8"), `MIDPOINT_SCIM_TOKEN=${token}\n`);
    assert.equal((await fs.stat(path.join(root, "docker/.env"))).mode & 0o777, 0o600);
  });
});

test("refuses tracked or nonignored destinations, symlink destination/parent, hardlinks and unsafe directory permissions", { skip: POSIX_ONLY }, async () => {
  for (const kind of ["tracked", "nonignored", "symlink", "parent-symlink", "hardlink", "permissions"] as const) {
    await fixture(async (root, options) => {
      const file = path.join(root, "docker/.env");
      const outside = path.join(root, "outside");
      await fs.writeFile(outside, "unchanged");
      if (kind === "tracked") { await fs.writeFile(file, "unchanged"); execFileSync("git", ["-C", root, "add", "--force", "docker/.env"]); }
      if (kind === "nonignored") await fs.writeFile(path.join(root, ".gitignore"), "");
      if (kind === "symlink") await fs.symlink(outside, file);
      if (kind === "hardlink") await fs.link(outside, file);
      if (kind === "parent-symlink") { await fs.rename(path.join(root, "docker"), path.join(root, "other")); await fs.symlink("other", path.join(root, "docker")); }
      if (kind === "permissions") await fs.chmod(path.join(root, "docker"), 0o777);
      await assert.rejects(writeDevelopmentToken(credential(), options), /IAM_SCIM_DEV_EXPORT_FAILED/);
      assert.equal(await fs.readFile(outside, "utf8"), "unchanged");
    });
  }
});

test("concurrent exports serialize replacement without losing unrelated settings", { skip: POSIX_ONLY }, async () => {
  await fixture(async (root, options) => {
    const file = path.join(root, "docker/.env");
    await fs.writeFile(file, "OTHER=keep\n", { mode: 0o600 });
    const tokens = [credential(), credential()];
    const results = await Promise.allSettled(tokens.map((token) => writeDevelopmentToken(token, options)));
    assert.ok(results.some((result) => result.status === "fulfilled"));
    const text = await fs.readFile(file, "utf8");
    assert.ok(tokens.some((token) => text === `OTHER=keep\nMIDPOINT_SCIM_TOKEN=${token}\n`));
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    assert.deepEqual(await fs.readdir(path.dirname(file)), [".env"]);
  });
});

test("destination and parent replacement races refuse delivery and clean temporary files", { skip: POSIX_ONLY }, async () => {
  for (const kind of ["destination", "parent"] as const) {
    await fixture(async (root, options) => {
      const file = path.join(root, "docker/.env");
      await fs.writeFile(file, "OTHER=keep\n", { mode: 0o600 });
      let reads = 0;
      const filesystem: typeof fs = { ...fs, lstat: (async (...args: Parameters<typeof fs.lstat>) => {
        if (args[0] === file && ++reads === 2) {
          if (kind === "destination") { await fs.unlink(file); await fs.writeFile(file, "changed\n", { mode: 0o600 }); }
          else { await fs.rename(path.join(root, "docker"), path.join(root, "moved")); await fs.mkdir(path.join(root, "docker")); }
        }
        return fs.lstat(...args);
      }) as typeof fs.lstat };
      await assert.rejects(writeDevelopmentToken(credential(), { ...options, filesystem }), /IAM_SCIM_DEV_EXPORT_FAILED/);
      if (kind === "destination") assert.equal(await fs.readFile(file, "utf8"), "changed\n");
      else assert.deepEqual(await fs.readdir(path.join(root, "docker")), []);
    });
  }
});

test("runtime adapter compiles the existing app and creates it without starting HTTP", async () => {
  const events: unknown[] = [];
  const backend = {
    load: async () => { events.push("load"); }, destroy: async () => { events.push("destroy"); },
    start: () => assert.fail("must not start"), listen: () => assert.fail("must not listen"),
  };
  const runtime = {
    compileStrapi: async (options: unknown) => { events.push(options); return { appDir: "/fixture/backend", distDir: "/fixture/backend/dist" }; },
    createStrapi: (options: unknown) => { events.push(options); return backend; },
  } as unknown as Parameters<typeof createTokenCliDependencies>[0];
  const deps = createTokenCliDependencies(runtime, "/fixture/backend");
  const created = await deps.createBackend();
  await created.load(); await created.destroy();
  assert.deepEqual(events, [{ appDir: "/fixture/backend" }, { appDir: "/fixture/backend", distDir: "/fixture/backend/dist" }, "load", "destroy"]);
});

function registeredDevelopmentSource() {
  const user = { documentId: "service-user", username: "midpoint-dev-provisioning", email: "midpoint-dev-provisioning@idambox.test",
    displayName: "midPoint (dev) provisioning", accountStatus: "active", protected: true,
    roles: [{ documentId: "role", name: "Identity Provisioning", functions: [{ name: "Identity Provisioning",
      application: { slug: "idambox-iam", applicationStatus: "active" } }] }] };
  const source = { documentId: sourceDocumentId, name: "midPoint (dev)", sourceStatus: "active", serviceUser: user };
  const host = { documents: (uid: string) => ({
    findOne: async () => uid === "api::identity-source.identity-source" ? source : user,
    findMany: async () => [source],
  }) } as unknown as Core.Strapi;
  return { user, source, host };
}

test("development export requires the exact seed registration and intact active service grant", async () => {
  const good = registeredDevelopmentSource();
  await assertDevelopmentSource(good.host, sourceDocumentId, "development");
  for (const environment of [undefined, "test", "production"]) {
    await assert.rejects(assertDevelopmentSource(good.host, sourceDocumentId, environment), /IAM_SCIM_DEV_SOURCE_REQUIRED/);
  }
  for (const field of ["name", "username", "email", "displayName", "sourceStatus", "accountStatus", "protected", "grant"] as const) {
    const fixture = registeredDevelopmentSource();
    if (field === "name") fixture.source.name = "another source";
    else if (field === "sourceStatus") fixture.source.sourceStatus = "inactive";
    else if (field === "protected") fixture.user.protected = false;
    else if (field === "grant") fixture.user.roles = [];
    else fixture.user[field] = "other";
    await assert.rejects(assertDevelopmentSource(fixture.host, sourceDocumentId, "development"), /IAM_SCIM_DEV_SOURCE_REQUIRED/);
  }
});

test("failed delivery compensation takes a source lock and cannot revoke a newer concurrent token", async () => {
  for (const newer of [false, true]) {
    const token = credential();
    const row = { documentId: sourceDocumentId, tokenHash: hashSourceToken(newer ? credential() : token) as string | null };
    const events: string[] = [];
    const query = { select: () => query, where: () => query, forUpdate: async () => { events.push("lock"); } };
    const host = { db: {
      metadata: { get: () => ({ tableName: "sources", attributes: { id: { columnName: "id" }, documentId: { columnName: "document_id" } } }) },
      dialect: { client: "postgres" }, inTransaction: () => false,
      transaction: async (work: (context: unknown) => Promise<unknown>) => {
        const result = await work({ trx: () => query, onCommit: (callback: () => void) => callback() });
        events.push("commit"); return result;
      },
    }, documents: () => ({ findOne: async () => row, update: async ({ data }: { data: { tokenHash: null } }) => {
      events.push("revoke"); row.tokenHash = data.tokenHash;
    } }), log: { info: () => undefined } } as unknown as Core.Strapi;
    await revokeUndeliveredToken(host, { action: "issue", sourceDocumentId, token, tokenRotatedAt: new Date().toISOString() });
    assert.equal(events[0], "lock");
    assert.equal(events.includes("revoke"), !newer);
    assert.equal(row.tokenHash === null, !newer);
  }
});

test("preserves existing restrictive owner mode and unrelated final line without newline", { skip: POSIX_ONLY }, async () => {
  await fixture(async (root, options) => {
    const file = path.join(root, "docker/.env");
    await fs.writeFile(file, "OTHER=keep", { mode: 0o400 });
    const token = credential();
    await writeDevelopmentToken(token, options);
    assert.equal(await fs.readFile(file, "utf8"), `OTHER=keep\nMIDPOINT_SCIM_TOKEN=${token}\n`);
    assert.equal((await fs.stat(file)).mode & 0o777, 0o400);
  });
});

test("filesystem write and rename failures preserve the old file and remove private staging", async () => {
  for (const stage of ["open", "rename"] as const) {
    await fixture(async (root, options) => {
      const file = path.join(root, "docker/.env");
      await fs.writeFile(file, "OTHER=keep\n", { mode: 0o600 });
      const filesystem: typeof fs = { ...fs };
      if (stage === "open") filesystem.open = (async (...args: Parameters<typeof fs.open>) => {
        if (String(args[0]).endsWith("/token")) throw new Error("filesystem failure");
        return fs.open(...args);
      }) as typeof fs.open;
      else filesystem.rename = async () => { throw new Error("filesystem failure"); };
      await assert.rejects(writeDevelopmentToken(credential(), { ...options, filesystem }), /IAM_SCIM_DEV_EXPORT_FAILED/);
      assert.equal(await fs.readFile(file, "utf8"), "OTHER=keep\n");
      assert.deepEqual(await fs.readdir(path.join(root, "docker")), [".env"]);
    });
  }
});

test("export preflight refusal changes no source token and still closes the backend", async () => {
  const h = harness();
  h.deps.validateExport = async () => { throw new Error("refused"); };
  assert.equal(await runTokenCli([sourceDocumentId, "--write-dev-env"], h.deps), 1);
  assert.deepEqual(h.events, ["create", "load", "stderr", "destroy"]);
  assert.deepEqual(h.output, []);
});
