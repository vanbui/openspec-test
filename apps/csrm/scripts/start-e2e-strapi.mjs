import { createRequire } from "node:module";
import { lstat, mkdir, mkdtemp, realpath, rmdir, unlink } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = await realpath(path.join(scriptDirectory, "..", "..", ".."));
const backendRoot = await realpath(path.join(root, "apps", "backend"));
const temporaryRoot = path.join(backendRoot, ".tmp");
const port = 1338;
const host = "127.0.0.1";
const internalToken = "idambox-csrm-e2e-internal-token-0123456789abcdef";
const environmentKeys = [
  "APP_KEYS",
  "API_TOKEN_SALT",
  "ADMIN_JWT_SECRET",
  "TRANSFER_TOKEN_SALT",
  "JWT_SECRET",
  "ENCRYPTION_KEY",
  "DATABASE_CLIENT",
  "DATABASE_FILENAME",
  "IDAMBOX_SEED_CORE",
  "IDAMBOX_SEED_CSRM",
  "IDAMBOX_KEYCLOAK_PROVISIONING",
  "IDAMBOX_CSRM_INTERNAL_TOKEN",
  "PORT",
  "csrmAppIsEnabled",
];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const savedEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));
let disposableDirectory;
let disposableIdentity;
let strapi;
let shuttingDown = false;

function restoreEnvironment() {
  for (const [key, value] of savedEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function assertDisposableDirectory(directory, expectedParent, expectedIdentity) {
  assert(path.dirname(directory) === expectedParent, "E2E database directory must be a direct backend .tmp child");
  assert(path.basename(directory).startsWith("csrm-e2e-strapi-"), "E2E database directory must use its dedicated prefix");
  const stats = await lstat(directory);
  assert(stats.isDirectory() && !stats.isSymbolicLink(), "E2E database directory must remain a real directory");
  assert(stats.dev === expectedIdentity.dev && stats.ino === expectedIdentity.ino, "E2E database directory identity changed; refusing cleanup");
}

async function releaseDisposableDatabase() {
  if (!disposableDirectory || !disposableIdentity) return;
  const canonicalTemporaryRoot = await realpath(temporaryRoot);
  for (const artifact of ["data.db", "data.db-wal", "data.db-shm", "data.db-journal"]) {
    await assertDisposableDirectory(disposableDirectory, canonicalTemporaryRoot, disposableIdentity);
    try {
      await unlink(path.join(disposableDirectory, artifact));
    } catch (error) {
      if (error && typeof error === "object" && error.code !== "ENOENT") throw error;
    }
  }
  await assertDisposableDirectory(disposableDirectory, canonicalTemporaryRoot, disposableIdentity);
  await rmdir(disposableDirectory);
  disposableDirectory = undefined;
  disposableIdentity = undefined;
}

async function assertPortAvailable() {
  await new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once("error", reject);
    listener.listen(port, host, () => listener.close((error) => error ? reject(error) : resolve()));
  });
}

async function waitForReady() {
  const deadline = Date.now() + 240_000;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${host}:${port}/api/csrm-assessment-requests`);
      if (response.status === 401 || response.status === 403) return;
      lastError = `unexpected HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Disposable Strapi did not become ready: ${lastError}`);
}

async function stopStrapi() {
  if (!strapi) return;
  await strapi.destroy();
  strapi = undefined;
}

async function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await stopStrapi();
    await releaseDisposableDatabase();
  } finally {
    restoreEnvironment();
  }
  process.exit(exitCode);
}

process.once("SIGINT", () => void shutdown(0));
process.once("SIGTERM", () => void shutdown(0));

try {
  await assertPortAvailable();
  await mkdir(temporaryRoot, { recursive: true });
  const canonicalTemporaryRoot = await realpath(temporaryRoot);
  disposableDirectory = await mkdtemp(path.join(canonicalTemporaryRoot, "csrm-e2e-strapi-"));
  const stats = await lstat(disposableDirectory);
  disposableIdentity = { dev: stats.dev, ino: stats.ino };
  await assertDisposableDirectory(disposableDirectory, canonicalTemporaryRoot, disposableIdentity);
  const databaseFile = path.join(disposableDirectory, "data.db");
  const databaseFilename = path.relative(backendRoot, databaseFile);
  assert(!path.isAbsolute(databaseFilename) && !databaseFilename.split(path.sep).includes(".."), "E2E database filename must remain backend-relative");
  assert(path.resolve(backendRoot, databaseFilename) === databaseFile, "E2E database filename must resolve to the disposable file");

  Object.assign(process.env, {
    APP_KEYS: "csrm-e2e-strapi-app-keys",
    API_TOKEN_SALT: "csrm-e2e-strapi-api-token-salt",
    ADMIN_JWT_SECRET: "csrm-e2e-strapi-admin-jwt-secret",
    TRANSFER_TOKEN_SALT: "csrm-e2e-strapi-transfer-token-salt",
    JWT_SECRET: "csrm-e2e-strapi-jwt-secret",
    ENCRYPTION_KEY: "csrm-e2e-strapi-encryption-key",
    DATABASE_CLIENT: "sqlite",
    DATABASE_FILENAME: databaseFilename,
    IDAMBOX_SEED_CORE: "false",
    IDAMBOX_SEED_CSRM: "true",
    IDAMBOX_KEYCLOAK_PROVISIONING: "false",
    IDAMBOX_CSRM_INTERNAL_TOKEN: internalToken,
    PORT: String(port),
    csrmAppIsEnabled: "true",
  });

  const { compileStrapi, createStrapi } = createRequire(import.meta.url)("@strapi/strapi");
  const appContext = await compileStrapi({ appDir: backendRoot });
  strapi = await createStrapi(appContext).load();
  await new Promise((resolve, reject) => {
    const server = strapi.server.httpServer ?? strapi.server;
    server.once("error", reject);
    strapi.server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  await waitForReady();
  process.stdout.write(`CSRM disposable Strapi is ready on http://${host}:${port} with bounded SQLite cleanup.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  await shutdown(1);
}
