import { createRequire } from "node:module";
import {
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import {
  CONTROL_DIRECTORY,
  readSeedControlFiles,
} from "./csrm-seed-control-files.mjs";

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
// The catalogues the seed loads and its title file, from the seed's own declarations (no second list).
const { catalogueFiles: controlCatalogueFiles, titleFile: controlTitleFile } =
  readSeedControlFiles(root);
const controlCatalogues = controlCatalogueFiles.map((sourceFile) => ({
  catalogue: createRequire(import.meta.url)(
    path.join(root, ...CONTROL_DIRECTORY, sourceFile),
  ),
  sourceFile,
}));
// D-46: CSRM's title for each control whose catalogue gives no label.
const controlTitles = new Map(
  Object.values(
    createRequire(import.meta.url)(
      path.join(root, ...CONTROL_DIRECTORY, controlTitleFile),
    ).titles,
  ).flatMap((catalogueTitles) => Object.entries(catalogueTitles)),
);
const expectedControls = controlCatalogues.flatMap(
  ({ catalogue: controlCatalogue, sourceFile }) =>
    controlCatalogue.controls.map((control) => ({
      catalogue: controlCatalogue,
      control,
      sourceFile,
    })),
);
const STALE_CONTROL_NUMBER = "CIS-1.1";
const MANUAL_CONTROL_NUMBER = "VERIFY-MANUAL-CONTROL";
const VERIFIER_RISK_TYPE_NAME = "CSRM seed relation verifier";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const firstString = (...values) =>
  values
    .find((value) => typeof value === "string" && value.trim().length > 0)
    ?.trim();

const expectedControlName = (control) => {
  const label = firstString(
    control.title,
    control.objective,
    control.strategy,
    control.section?.name,
    control.category?.title,
    control.groupPath?.at(-1),
  ) ?? controlTitles.get(control.id);

  return label ? `${control.id} — ${label}` : control.id;
};

const expectedControlReference = (control) =>
  firstString(
    control.sourceClause,
    typeof control.clause === "number"
      ? `Clause ${control.clause}`
      : control.clause,
    control.oscalId,
    control.objectiveId,
    control.parentControl?.id,
    control.category?.id,
    control.section?.id,
    typeof control.sectionNumber === "string"
      ? `Section ${control.sectionNumber}`
      : undefined,
  );

const findAllControls = async (controlService) => {
  const controls = [];
  let start = 0;

  while (true) {
    const page = await controlService.findMany({
      limit: 1000,
      sort: ["controlNumber:asc"],
      start,
    });
    controls.push(...page);

    if (page.length < 1000) {
      return controls;
    }

    start += page.length;
  }
};

const prepareUpdateVerification = async (strapi) => {
  const controlService = strapi.documents("api::csrm-control.csrm-control");
  const riskTypeService = strapi.documents(
    "api::csrm-risk-type.csrm-risk-type",
  );
  const staleControls = await controlService.findMany({
    filters: { controlNumber: { $eq: STALE_CONTROL_NUMBER } },
    limit: 1,
  });
  const [staleControl] = staleControls;

  assert(
    staleControl,
    `${STALE_CONTROL_NUMBER} must exist before update testing`,
  );

  await controlService.create({
    data: {
      controlNumber: MANUAL_CONTROL_NUMBER,
      framework: "Custom",
      name: "Verifier-managed custom Control",
    },
  });
  await riskTypeService.create({
    data: {
      applicableControls: [staleControl.documentId],
      description:
        "Verifies that catalogue updates preserve Control relations.",
      name: VERIFIER_RISK_TYPE_NAME,
    },
  });
  // What an earlier seed wrote from an older catalogue entry: the entry in sourceData beside the name and
  // description derived from it. The seed recognises both as its own and replaces them (fix 2, fix 3).
  await controlService.update({
    documentId: staleControl.documentId,
    data: {
      description: "Stale verifier value",
      framework: "Stale verifier framework",
      name: `${STALE_CONTROL_NUMBER} — Stale verifier name`,
      sourceData: {
        ...staleControl.sourceData,
        control: {
          ...staleControl.sourceData.control,
          statement: "Stale verifier value",
          title: "Stale verifier name",
        },
      },
    },
  });
};

const assertUpdateVerification = async (strapi) => {
  const controlService = strapi.documents("api::csrm-control.csrm-control");
  const riskTypeService = strapi.documents(
    "api::csrm-risk-type.csrm-risk-type",
  );
  const manualControls = await controlService.findMany({
    filters: { controlNumber: { $eq: MANUAL_CONTROL_NUMBER } },
    limit: 2,
  });
  const verifierRiskTypes = await riskTypeService.findMany({
    filters: { name: { $eq: VERIFIER_RISK_TYPE_NAME } },
    populate: { applicableControls: true },
    limit: 2,
  });

  assert(
    manualControls.length === 1 &&
      manualControls[0].name === "Verifier-managed custom Control" &&
      manualControls[0].framework === "Custom",
    "CSRM seed must preserve manually managed Controls",
  );
  assert(
    verifierRiskTypes.length === 1 &&
      verifierRiskTypes[0].applicableControls.some(
        (control) => control.controlNumber === STALE_CONTROL_NUMBER,
      ),
    "CSRM seed updates must preserve existing Control relations",
  );
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

const loadAndAssert = async (
  strapi,
  expectedCounts,
  expectedChangedControlNumber,
) => {
  const applicationService = strapi.documents("api::application.application");
  const functionService = strapi.documents("api::function.function");
  const functionApiService = strapi.documents("api::function-api.function-api");
  const roleService = strapi.documents("api::role.role");
  const userService = strapi.documents("api::idambox-user.idambox-user");
  const controlService = strapi.documents("api::csrm-control.csrm-control");

  const applications = await applicationService.findMany({
    filters: { slug: { $eq: "idambox-csrm" } },
    populate: { functions: { populate: { functionApis: true } } },
    limit: 10,
  });
  assert(
    applications.length === 1,
    "Expected exactly one IdamBox CSRM application",
  );
  const [application] = applications;
  assert(
    application.name === "IdamBox CSRM",
    "CSRM application name must be canonical",
  );
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
  const roles = await roleService.findMany({
    populate: { functions: true },
    limit: 1000,
  });
  const users = await userService.findMany({
    populate: { roles: true },
    limit: 1000,
  });
  const controls = await findAllControls(controlService);

  assert(
    controls.length >= expectedControls.length,
    `Expected at least ${expectedControls.length} CSRM Controls, found ${controls.length}`,
  );
  const controlByNumber = new Map(
    controls.map((control) => [control.controlNumber, control]),
  );
  assert(
    controlByNumber.size === controls.length,
    "Every persisted Control must have a unique control number",
  );

  for (const expectedControl of expectedControls) {
    const {
      catalogue: controlCatalogue,
      control,
      sourceFile,
    } = expectedControl;
    const seededControl = controlByNumber.get(control.id);
    const frameworkVersion =
      controlCatalogue.framework.version ?? controlCatalogue.framework.release;
    const { controls: _controls, ...catalogueData } = controlCatalogue;
    const description = firstString(
      control.statement,
      control.legalText,
      control.title,
    );

    assert(seededControl, `Control ${control.id} must be persisted`);
    assert(
      seededControl.name === expectedControlName(control),
      `Control ${control.id} must retain its normalized name`,
    );
    assert(
      (seededControl.description ?? undefined) === description,
      `Control ${control.id} must retain its source description`,
    );
    assert(
      seededControl.framework === controlCatalogue.framework.name,
      `Control ${control.id} must retain its framework`,
    );
    assert(
      (seededControl.frameworkVersion ?? undefined) === frameworkVersion,
      `Control ${control.id} must retain its framework version`,
    );
    assert(
      seededControl.frameworkSource === controlCatalogue.framework.source,
      `Control ${control.id} must retain its framework source`,
    );
    assert(
      (seededControl.controlReference ?? undefined) ===
        expectedControlReference(control),
      `Control ${control.id} must retain its normalized source reference`,
    );
    assert(
      seededControl.controlType == null,
      `Control ${control.id} must not infer an implementation control type`,
    );
    assert(
      seededControl.sourceData?.sourceFile === sourceFile &&
        JSON.stringify(seededControl.sourceData.control) ===
          JSON.stringify(control),
      `Control ${control.id} must retain its lossless source data`,
    );
    assert(
      JSON.stringify(seededControl.sourceData?.catalogue) ===
        JSON.stringify(catalogueData),
      `Control ${control.id} must retain its catalogue provenance`,
    );
  }

  assert(
    functions.length === catalogue.functions.length,
    `Expected ${catalogue.functions.length} CSRM Functions, found ${functions.length}`,
  );
  assert(
    functionApis.length === catalogue.functionApis.length,
    `Expected ${catalogue.functionApis.length} FunctionApis, found ${functionApis.length}`,
  );

  // The seed keys a Function by its name and menu path; an API-only Function stores no menu path.
  const functionKey = ({ menuPath, name }) => `${name}\u0000${menuPath ?? ""}`;
  const functionByKey = new Map(
    functions.map((platformFunction) => [
      functionKey(platformFunction),
      platformFunction,
    ]),
  );
  for (const functionSeed of catalogue.functions) {
    const seededFunction = functionByKey.get(functionKey(functionSeed));
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
      JSON.stringify(actualFunctionApis) ===
        JSON.stringify(expectedFunctionApis),
      `Function ${functionSeed.id} must retain its exact FunctionApi grants`,
    );
  }

  const expectedRoleNames = catalogue.roles.map((role) => role.name).sort();
  const seededRoles = roles.filter((role) =>
    expectedRoleNames.includes(role.name),
  );
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
        return functionByKey.get(functionKey(functionSeed))?.documentId;
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
  const analystFunctionIds = analyst.functions
    .map((item) => item.documentId)
    .sort();
  const agentFunctionIds = agent.functions
    .map((item) => item.documentId)
    .sort();
  assert(
    analystFunctionIds.length > 0,
    "Security Analyst must have Function grants",
  );
  // The agent holds a subset of the human analyst's grants by the catalogue's design, never more.
  assert(
    agentFunctionIds.every((functionId) =>
      analystFunctionIds.includes(functionId),
    ),
    "Security Analyst Agent must hold no Function grant that Security Analyst lacks",
  );

  const jane = users.find((user) => user.email === "jane.doe@idambox.com");
  const bob = users.find((user) => user.email === "bob.doe@idambox.com");
  assert(
    jane?.accountStatus === "active",
    "Jane must be an active IdamBox user",
  );
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
    controls: expectedControls.length,
  };
  const expectedControlNumbers = new Set(
    expectedControls.map(({ control }) => control.id),
  );
  const controlUpdatedAt = controls
    .filter((control) => expectedControlNumbers.has(control.controlNumber))
    .map((control) => `${control.controlNumber}\u0000${control.updatedAt}`)
    .sort();
  if (expectedCounts) {
    const {
      controlUpdatedAt: expectedControlUpdatedAt,
      ...expectedCountValues
    } = expectedCounts;

    assert(
      JSON.stringify(actualCounts) === JSON.stringify(expectedCountValues),
      "Second boot must preserve the exact seeded record counts",
    );
    assert(
      JSON.stringify(
        controlUpdatedAt.filter(
          (value) => !value.startsWith(`${expectedChangedControlNumber}\u0000`),
        ),
      ) ===
        JSON.stringify(
          expectedControlUpdatedAt.filter(
            (value) =>
              !value.startsWith(`${expectedChangedControlNumber}\u0000`),
          ),
        ),
      "Second boot must leave unchanged Controls untouched",
    );
  }
  return { ...actualCounts, controlUpdatedAt };
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
  disposableDir = await mkdtemp(
    path.join(canonicalTemporaryRoot, "verify-csrm-seed-"),
  );
  assertDisposableDirectory(disposableDir, canonicalTemporaryRoot);
  const disposableDirStats = await lstat(disposableDir);
  assert(
    !disposableDirStats.isSymbolicLink(),
    "Disposable directory must not be a symlink",
  );
  assert(
    disposableDirStats.isDirectory(),
    "Disposable path must be a directory",
  );
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

  // Strapi is the backend's dependency, so resolve it from the backend package, not from this script.
  const { compileStrapi, createStrapi } = createRequire(
    path.join(backendRoot, "package.json"),
  )("@strapi/strapi");
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
  await prepareUpdateVerification(strapi);
  await strapi.destroy();
  strapi = undefined;

  strapi = await createStrapi(appContext).load();
  await loadAndAssert(strapi, firstBootCounts, STALE_CONTROL_NUMBER);
  await assertUpdateVerification(strapi);
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
