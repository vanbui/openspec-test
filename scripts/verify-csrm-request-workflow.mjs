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
  const httpServer = server.httpServer ?? server;
  httpServer.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    httpServer.off("error", reject);
    const address = httpServer.address();
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
const shouldRun = (name) => selectedCases.size === 0 || selectedCases.has(name);

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
  const informationSystem = await strapi.documents("api::csrm-information-system.csrm-information-system").create({ data: { name: "Verifier system" } });
  const informationAsset = await strapi.documents("api::csrm-information-asset.csrm-information-asset").create({ data: { name: "Verifier asset" } });

  const baseUrl = await listen(strapi.server);
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

  if (shouldRun("owned-draft-tracer")) {
    const owned = await request(baseUrl, `/csrm-assessment-requests/${created.documentId}`);
    assert(owned.response.status === 200, "Owner must read its draft");
    const nonOwned = await request(baseUrl, `/csrm-assessment-requests/${created.documentId}`, { headers: { [actorHeader]: "ownership.verifier@idambox.com" } });
    const unknown = await request(baseUrl, "/csrm-assessment-requests/aaaaaaaaaaaaaaaaaaaaaaaa");
    assert(nonOwned.response.status === unknown.response.status && nonOwned.body === unknown.body, "Unknown and non-owned denials must be byte-equivalent");
    const unauthenticated = await fetch(`${baseUrl}/api/csrm-assessment-requests/${created.documentId}`);
    assert(unauthenticated.status === 403 || unauthenticated.status === 401, "Requests must require an internal caller token");
  }

  if (shouldRun("lifecycle")) {
    const draftData = {
      title: "Lifecycle draft", description: "A complete request description.", assessmentType: "Project",
      businessPurpose: "Verify lifecycle boundaries.", businessCriticality: "High",
      thirdPartyInvolvement: true, thirdPartyDetails: "External service provider.",
      informationSystems: [informationSystem.documentId], informationAssets: [informationAsset.documentId],
    };
    const saved = await request(baseUrl, `/csrm-assessment-requests/${created.documentId}`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: { ...draftData, requestStatus: "approved", requestor: secondUser.documentId } }),
    });
    assert(saved.response.status === 200, "Owner must save a title-only draft");
    assert(JSON.parse(saved.body).data.requestStatus === "draft", "Save must ignore client workflow fields");
    const submitted = await request(baseUrl, `/csrm-assessment-requests/${created.documentId}/submit`, { method: "POST" });
    assert(submitted.response.status === 200 && JSON.parse(submitted.body).data.requestStatus === "submitted", "Owner submit must be server-controlled");
    const withdrawn = await request(baseUrl, `/csrm-assessment-requests/${created.documentId}/withdraw`, { method: "POST" });
    assert(withdrawn.response.status === 200 && JSON.parse(withdrawn.body).data.requestStatus === "draft", "Owner withdraw must only return submitted work to draft");
    const cleared = JSON.parse(withdrawn.body).data;
    assert(!cleared.submittedDate, "Withdraw must clear submittedDate");
    const invalidRelation = await request(baseUrl, `/csrm-assessment-requests/${created.documentId}`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: { informationSystems: ["unknown-catalogue-document"] } }),
    });
    assert(invalidRelation.response.status === 400, "Unknown catalogue relation IDs must be rejected");
    await strapi.documents("api::csrm-assessment-request.csrm-assessment-request").update({
      documentId: created.documentId, data: { requestStatus: "approved" },
    });
    const locked = await request(baseUrl, `/csrm-assessment-requests/${created.documentId}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { title: "must not save" } }),
    });
    assert(locked.response.status === 403, "Later processing statuses must be owner read-only");
  }

  if (shouldRun("list-dashboard")) {
    const list = await request(baseUrl, "/csrm-assessment-requests?keyword=Lifecycle&sort=updatedAt:desc&page=1&pageSize=1");
    const listData = JSON.parse(list.body).data;
    assert(list.response.status === 200 && listData.length <= 1, "Owner list must use bounded pagination");
    const invalidQuery = await request(baseUrl, "/csrm-assessment-requests?filters[requestStatus][$eq]=draft");
    assert(invalidQuery.response.status === 400, "Arbitrary Strapi filters must be rejected");
    const dashboard = await request(baseUrl, "/csrm-assessment-requests/dashboard");
    assert(dashboard.response.status === 200, "Dashboard must be available through a protected bounded route");
    assert(JSON.parse(dashboard.body).data.statusCounts, "Dashboard must return derived status counts");
  }

  if (shouldRun("analyst-draft")) {
    const analystDraft = await request(baseUrl, "/csrm-assessment-requests", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: { title: "Analyst collaboration draft", thirdPartyInvolvement: false, thirdPartyDetails: "must clear" } }),
    });
    const analystRequest = JSON.parse(analystDraft.body).data;
    const analystRead = await request(baseUrl, `/csrm-assessment-requests/${analystRequest.documentId}`, { headers: { [actorHeader]: "bob.doe@idambox.com" } });
    assert(analystRead.response.status === 200, "Persisted analyst Function must permit reading an unsubmitted Requestor draft");
    const analystSave = await request(baseUrl, `/csrm-assessment-requests/${analystRequest.documentId}`, {
      method: "PUT", headers: { "content-type": "application/json", [actorHeader]: "bob.doe@idambox.com" },
      body: JSON.stringify({ data: { title: "Analyst-enriched draft", thirdPartyInvolvement: false, thirdPartyDetails: "must clear" } }),
    });
    const analystData = JSON.parse(analystSave.body).data;
    assert(analystSave.response.status === 200 && analystData.requestStatus === "draft", "Analyst saves must preserve draft status");
    assert(analystData.requestor?.documentId === created.requestor.documentId && !analystData.thirdPartyDetails, "Analyst saves preserve owner and clear hidden third-party details");
    const analystSubmit = await request(baseUrl, `/csrm-assessment-requests/${analystRequest.documentId}/submit`, { method: "POST", headers: { [actorHeader]: "bob.doe@idambox.com" } });
    assert(analystSubmit.response.status === 404 && !analystSubmit.body.includes("Analyst collaboration draft"), "Analyst submission must be metadata-safe and denied");
  }

  console.log("CSRM request workflow verifier passed: ownership, lifecycle, list/dashboard, analyst collaboration, listener release, disposable cleanup");
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
