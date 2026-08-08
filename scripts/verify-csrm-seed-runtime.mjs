import { createRequire } from "node:module";
import { lstat, mkdir, mkdtemp, realpath, rmdir, unlink } from "node:fs/promises";
import path from "node:path";

const root = await realpath(process.cwd());
const backendRoot = await realpath(path.join(root, "apps", "backend"));
const temporaryRoot = path.join(backendRoot, ".tmp");
const overriddenEnvironmentKeys = [
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
  "csrmAppIsEnabled",
];
const catalogue = createRequire(import.meta.url)(
  path.join(
    root,
    "apps",
    "backend",
    "src",
    "bootstrap",
    "idambox-csrm-role-function-api-catalogue.json",
  ),
);

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertDisposableDirectory = (directory, expectedParent) => {
  assert(
    path.dirname(directory) === expectedParent,
    `Disposable directory must be a direct child of ${expectedParent}`,
  );
  assert(
    path.basename(directory).startsWith("verify-csrm-seed-"),
    "Disposable directory must use the verify-csrm-seed prefix",
  );
};

const assertDisposableDirectoryIdentity = async (
  directory,
  expectedParent,
  expectedIdentity,
) => {
  assertDisposableDirectory(directory, expectedParent);
  const stats = await lstat(directory);
  assert(!stats.isSymbolicLink(), "Disposable directory must not be a symlink");
  assert(stats.isDirectory(), "Disposable path must remain a directory");
  assert(
    stats.dev === expectedIdentity.dev && stats.ino === expectedIdentity.ino,
    "Disposable directory identity changed; refusing cleanup",
  );
};

const assertRelativeDatabaseFilename = (filename, databaseFile) => {
  assert(filename.length > 0, "DATABASE_FILENAME must not be empty");
  assert(!path.isAbsolute(filename), "DATABASE_FILENAME must be relative");
  assert(
    !filename.split(path.sep).includes(".."),
    "DATABASE_FILENAME must not contain parent-directory segments",
  );
  assert(
    filename.startsWith(path.join(".tmp", "verify-csrm-seed-")),
    "DATABASE_FILENAME must target the verifier-owned .tmp child",
  );
  assert(
    path.resolve(backendRoot, filename) === databaseFile,
    "DATABASE_FILENAME must resolve exactly to the disposable database file",
  );
};

const envAdapter = (values) => {
  const env = (key, fallback) => values[key] ?? fallback;
  env.bool = (key, fallback = false) => {
    const value = env(key, fallback);
    return value === true || value === "true" || value === 1 || value === "1";
  };
  env.int = (key, fallback) => Number.parseInt(env(key, fallback), 10);
  return env;
};

const loadAndAssert = async (strapi, expectedCounts) => {
  const applicationService = strapi.documents("api::application.application");
  const functionService = strapi.documents("api::function.function");
  const functionApiService = strapi.documents("api::function-api.function-api");
  const roleService = strapi.documents("api::role.role");
  const userService = strapi.documents("api::idambox-user.idambox-user");

  const applications = await applicationService.findMany({
    filters: { slug: { $eq: "idambox-csrm" } },
    populate: { functions: { populate: { functionApis: true } } },
    limit: 10,
  });
  assert(applications.length === 1, "Expected exactly one IdamBox CSRM application");
  const [application] = applications;
  assert(application.name === "IdamBox CSRM", "CSRM application name must be canonical");
  assert(
    application.applicationStatus === "active",
    "CSRM application must be active",
  );
  assert(
    application.description.includes("Cybersecurity Risk Manager"),
    "CSRM application description must expand CSRM",
  );

  const functions = await functionService.findMany({
    filters: { application: { documentId: { $eq: application.documentId } } },
    populate: { functionApis: true },
    limit: 1000,
  });
  const functionApis = await functionApiService.findMany({ limit: 1000 });
  const roles = await roleService.findMany({ populate: { functions: true }, limit: 1000 });
  const users = await userService.findMany({ populate: { roles: true }, limit: 1000 });

  assert(
    functions.length === catalogue.functions.length,
    `Expected ${catalogue.functions.length} CSRM Functions, found ${functions.length}`,
  );
  assert(
    functionApis.length === catalogue.functionApis.length,
    `Expected ${catalogue.functionApis.length} FunctionApis, found ${functionApis.length}`,
  );

  const functionByMenuPath = new Map(
    functions.map((platformFunction) => [platformFunction.menuPath, platformFunction]),
  );
  for (const functionSeed of catalogue.functions) {
    const seededFunction = functionByMenuPath.get(functionSeed.menuPath);
    assert(
      seededFunction?.name === functionSeed.name,
      `Function ${functionSeed.id} must be persisted with its canonical name and menu path`,
    );
    const expectedFunctionApis = catalogue.functionApis
      .filter((functionApi) => functionApi.functionId === functionSeed.id)
      .map((functionApi) => `${functionApi.name}\u0000${functionApi.url}`)
      .sort();
    const actualFunctionApis = seededFunction.functionApis
      .map((functionApi) => `${functionApi.name}\u0000${functionApi.url}`)
      .sort();
    assert(
      JSON.stringify(actualFunctionApis) === JSON.stringify(expectedFunctionApis),
      `Function ${functionSeed.id} must retain its exact FunctionApi grants`,
    );
  }

  const expectedRoleNames = catalogue.roles.map((role) => role.name).sort();
  const seededRoles = roles.filter((role) => expectedRoleNames.includes(role.name));
  assert(
    seededRoles.length === expectedRoleNames.length,
    "Every catalogue Role must be persisted exactly once",
  );
  const roleByName = new Map(seededRoles.map((role) => [role.name, role]));
  for (const roleSeed of catalogue.roles) {
    const seededRole = roleByName.get(roleSeed.name);
    const expectedFunctionDocumentIds = roleSeed.functionIds
      .map((functionId) => {
        const functionSeed = catalogue.functions.find(
          (item) => item.id === functionId,
        );
        return functionByMenuPath.get(functionSeed.menuPath)?.documentId;
      })
      .sort();
    const actualFunctionDocumentIds = seededRole.functions
      .map((item) => item.documentId)
      .sort();
    assert(
      JSON.stringify(actualFunctionDocumentIds) ===
        JSON.stringify(expectedFunctionDocumentIds),
      `Role ${roleSeed.id} must retain its exact Function document-ID set`,
    );
  }
  const analyst = roleByName.get("Security Analyst");
  const agent = roleByName.get("Security Analyst Agent");
  assert(analyst, "Security Analyst Role must exist");
  assert(agent, "Security Analyst Agent Role must exist");
  const analystFunctionIds = analyst.functions.map((item) => item.documentId).sort();
  const agentFunctionIds = agent.functions.map((item) => item.documentId).sort();
  assert(analystFunctionIds.length > 0, "Security Analyst must have Function grants");
  assert(
    JSON.stringify(agentFunctionIds) === JSON.stringify(analystFunctionIds),
    "Security Analyst Agent must have exactly the Security Analyst Function grants",
  );

  const jane = users.find((user) => user.email === "jane.doe@idambox.com");
  const bob = users.find((user) => user.email === "bob.doe@idambox.com");
  assert(jane?.accountStatus === "active", "Jane must be an active IdamBox user");
  assert(bob?.accountStatus === "active", "Bob must be an active IdamBox user");
  assert(jane.roles.length === 0, "Jane must remain role-free");
  assert(
    bob.roles.length === 1 && bob.roles[0].name === "Security Analyst",
    "Bob must have only the Security Analyst Role",
  );

  const actualCounts = {
    applications: applications.length,
    functions: functions.length,
    functionApis: functionApis.length,
    roles: seededRoles.length,
    users: [jane, bob].filter(Boolean).length,
  };
  if (expectedCounts) {
    assert(
      JSON.stringify(actualCounts) === JSON.stringify(expectedCounts),
      "Second boot must preserve the exact seeded record counts",
    );
  }
  return actualCounts;
};

const savedEnvironment = new Map(
  overriddenEnvironmentKeys.map((key) => [key, process.env[key]]),
);
let disposableDir;
let disposableDirIdentity;
let strapi;

try {
  await mkdir(temporaryRoot, { recursive: true });
  const canonicalTemporaryRoot = await realpath(temporaryRoot);
  disposableDir = await mkdtemp(path.join(canonicalTemporaryRoot, "verify-csrm-seed-"));
  assertDisposableDirectory(disposableDir, canonicalTemporaryRoot);
  const disposableDirStats = await lstat(disposableDir);
  assert(!disposableDirStats.isSymbolicLink(), "Disposable directory must not be a symlink");
  assert(disposableDirStats.isDirectory(), "Disposable path must be a directory");
  disposableDirIdentity = {
    dev: disposableDirStats.dev,
    ino: disposableDirStats.ino,
  };
  const databaseFile = path.join(disposableDir, "data.db");
  const databaseFilename = path.relative(backendRoot, databaseFile);
  assertRelativeDatabaseFilename(databaseFilename, databaseFile);

  Object.assign(process.env, {
    APP_KEYS: "verify-csrm-seed-app-keys",
    API_TOKEN_SALT: "verify-csrm-seed-api-token-salt",
    ADMIN_JWT_SECRET: "verify-csrm-seed-admin-jwt-secret",
    TRANSFER_TOKEN_SALT: "verify-csrm-seed-transfer-token-salt",
    JWT_SECRET: "verify-csrm-seed-jwt-secret",
    ENCRYPTION_KEY: "verify-csrm-seed-encryption-key",
    DATABASE_CLIENT: "sqlite",
    DATABASE_FILENAME: databaseFilename,
    IDAMBOX_SEED_CORE: "false",
    IDAMBOX_SEED_CSRM: "true",
    IDAMBOX_KEYCLOAK_PROVISIONING: "false",
    csrmAppIsEnabled: "false",
  });

  const { compileStrapi, createStrapi } = createRequire(import.meta.url)("@strapi/strapi");
  const appContext = await compileStrapi({ appDir: backendRoot });
  const databaseConfig = createRequire(import.meta.url)(
    path.join(appContext.distDir, "config", "database.js"),
  );
  const databaseFactory = databaseConfig.default ?? databaseConfig;
  const compiledDatabaseConfig = databaseFactory({
    env: envAdapter({
      DATABASE_CLIENT: "sqlite",
      DATABASE_FILENAME: databaseFilename,
    }),
  });
  assert(
    compiledDatabaseConfig.connection.connection.filename === databaseFile,
    "Compiled database config must resolve to the verifier-owned database file",
  );

  strapi = await createStrapi(appContext).load();
  const firstBootCounts = await loadAndAssert(strapi);
  await strapi.destroy();
  strapi = undefined;

  strapi = await createStrapi(appContext).load();
  await loadAndAssert(strapi, firstBootCounts);
  await strapi.destroy();
  strapi = undefined;

  console.log("IdamBox CSRM runtime seed verification passed");
} finally {
  if (strapi) {
    await strapi.destroy();
  }
  for (const [key, value] of savedEnvironment) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  if (disposableDir && disposableDirIdentity) {
    const canonicalTemporaryRoot = await realpath(temporaryRoot);
    const sqliteArtifacts = [
      "data.db",
      "data.db-wal",
      "data.db-shm",
      "data.db-journal",
    ];
    for (const artifact of sqliteArtifacts) {
      await assertDisposableDirectoryIdentity(
        disposableDir,
        canonicalTemporaryRoot,
        disposableDirIdentity,
      );
      try {
        await unlink(path.join(disposableDir, artifact));
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }
    await assertDisposableDirectoryIdentity(
      disposableDir,
      canonicalTemporaryRoot,
      disposableDirIdentity,
    );
    await rmdir(disposableDir);
  }
}
