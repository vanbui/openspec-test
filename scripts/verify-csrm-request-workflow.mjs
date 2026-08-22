import { createRequire } from "node:module";
import { lstat, mkdir, mkdtemp, realpath, rmdir, unlink } from "node:fs/promises";
import path from "node:path";

const root = await realpath(process.cwd());
const backendRoot = await realpath(path.join(root, "apps", "backend"));
const temporaryRoot = path.join(backendRoot, ".tmp");
const internalToken = "verify-csrm-request-workflow-token-0123456789abcdef";
const actorHeader = "x-idambox-csrm-actor-email";
const environmentKeys = [
  "APP_KEYS", "API_TOKEN_SALT", "ADMIN_JWT_SECRET", "TRANSFER_TOKEN_SALT",
  "JWT_SECRET", "ENCRYPTION_KEY", "DATABASE_CLIENT", "DATABASE_FILENAME",
  "IDAMBOX_SEED_CORE", "IDAMBOX_SEED_CSRM", "IDAMBOX_KEYCLOAK_PROVISIONING",
  "IDAMBOX_CSRM_INTERNAL_TOKEN", "csrmAppIsEnabled",
];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertDisposableDirectory = async (directory, expectedParent, identity) => {
  assert(path.dirname(directory) === expectedParent, "Disposable directory must be a direct .tmp child");
  assert(path.basename(directory).startsWith("verify-csrm-request-workflow-"), "Disposable directory has an unsafe prefix");
  const stats = await lstat(directory);
  assert(stats.isDirectory() && !stats.isSymbolicLink(), "Disposable directory must remain a real directory");
  assert(stats.dev === identity.dev && stats.ino === identity.ino, "Disposable directory identity changed before cleanup");
};

const listen = (server) => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    server.off("error", reject);
    const address = server.address();
    resolve(`http://127.0.0.1:${address.port}`);
  });
});

const request = async (baseUrl, pathname, options = {}) => {
  const response = await fetch(`${baseUrl}/api${pathname}`, {
    ...options,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${internalToken}`,
      [actorHeader]: "jane.doe@idambox.com",
      ...(options.headers ?? {}),
    },
  });
  return { body: await response.text(), response };
};

const selectedCases = new Set(
  process.argv.flatMap((argument, index, values) => argument === "--case" ? [values[index + 1]] : []),
);
if (selectedCases.size > 0 && !selectedCases.has("owned-draft-tracer")) process.exit(0);

const savedEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));
let disposableDir;
let disposableIdentity;
let strapi;

try {
  await mkdir(temporaryRoot, { recursive: true });
  const canonicalTemporaryRoot = await realpath(temporaryRoot);
  disposableDir = await mkdtemp(path.join(canonicalTemporaryRoot, "verify-csrm-request-workflow-"));
  const stats = await lstat(disposableDir);
  disposableIdentity = { dev: stats.dev, ino: stats.ino };
  await assertDisposableDirectory(disposableDir, canonicalTemporaryRoot, disposableIdentity);
  const databaseFile = path.join(disposableDir, "data.db");
  const databaseFilename = path.relative(backendRoot, databaseFile);
  assert(databaseFilename.startsWith(path.join(".tmp", "verify-csrm-request-workflow-")), "Verifier database must remain in its own .tmp child");

  Object.assign(process.env, {
    APP_KEYS: "verify-csrm-request-workflow-app-keys",
    API_TOKEN_SALT: "verify-csrm-request-workflow-api-token-salt",
    ADMIN_JWT_SECRET: "verify-csrm-request-workflow-admin-jwt-secret",
    TRANSFER_TOKEN_SALT: "verify-csrm-request-workflow-transfer-token-salt",
    JWT_SECRET: "verify-csrm-request-workflow-jwt-secret",
    ENCRYPTION_KEY: "verify-csrm-request-workflow-encryption-key",
    DATABASE_CLIENT: "sqlite",
    DATABASE_FILENAME: databaseFilename,
    IDAMBOX_SEED_CORE: "false",
    IDAMBOX_SEED_CSRM: "true",
    IDAMBOX_KEYCLOAK_PROVISIONING: "false",
    IDAMBOX_CSRM_INTERNAL_TOKEN: internalToken,
    csrmAppIsEnabled: "true",
  });

  const { compileStrapi, createStrapi } = createRequire(import.meta.url)("@strapi/strapi");
  const appContext = await compileStrapi({ appDir: backendRoot });
  strapi = await createStrapi(appContext).load();
  const userService = strapi.documents("api::idambox-user.idambox-user");
  const secondUser = await userService.create({ data: {
    email: "ownership.verifier@idambox.com", username: "ownership.verifier",
    displayName: "Ownership Verifier", accountStatus: "active",
  } });
  assert(secondUser.documentId, "Verifier must create a second active IdamBoxUser");

  const baseUrl = await listen(strapi.server.httpServer);
  const forgedCreate = await request(baseUrl, "/csrm-assessment-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: {
      title: "Tracer-owned request", requestor: secondUser.documentId,
      requestNumber: "FORGED", requestStatus: "submitted", submittedDate: "2000-01-01T00:00:00.000Z",
    } }),
  });
  assert(forgedCreate.response.status === 201, `Owner draft create must return 201, received ${forgedCreate.response.status}`);
  const created = JSON.parse(forgedCreate.body).data;
  assert(created.requestNumber?.startsWith("CRA-"), "Create must generate a CRA request number");
  assert(created.requestStatus === "draft" && !created.submittedDate, "Forged workflow values must not persist");
  assert(created.requestor?.documentId !== secondUser.documentId, "Forged requestor must not persist");

  const owned = await request(baseUrl, `/csrm-assessment-requests/${created.documentId}`);
  assert(owned.response.status === 200, "Owner must read its draft");
  const nonOwned = await request(baseUrl, `/csrm-assessment-requests/${created.documentId}`, { headers: { [actorHeader]: "ownership.verifier@idambox.com" } });
  const unknown = await request(baseUrl, "/csrm-assessment-requests/aaaaaaaaaaaaaaaaaaaaaaaa");
  assert(nonOwned.response.status === unknown.response.status && nonOwned.body === unknown.body, "Unknown and non-owned denials must be byte-equivalent");

  const unauthenticated = await fetch(`${baseUrl}/api/csrm-assessment-requests/${created.documentId}`);
  assert(unauthenticated.status === 403 || unauthenticated.status === 401, "Requests must require an internal caller token");
  console.log("CSRM request workflow verifier passed: owned draft tracer, metadata-safe denial, listener release, disposable cleanup");
} finally {
  if (strapi) await strapi.destroy();
  for (const [key, value] of savedEnvironment) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  if (disposableDir && disposableIdentity) {
    const canonicalTemporaryRoot = await realpath(temporaryRoot);
    for (const name of ["data.db", "data.db-wal", "data.db-shm", "data.db-journal"]) {
      await assertDisposableDirectory(disposableDir, canonicalTemporaryRoot, disposableIdentity);
      try { await unlink(path.join(disposableDir, name)); } catch (error) { if (error?.code !== "ENOENT") throw error; }
    }
    await assertDisposableDirectory(disposableDir, canonicalTemporaryRoot, disposableIdentity);
    await rmdir(disposableDir);
  }
}
