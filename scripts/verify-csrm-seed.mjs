import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  CONTROL_DIRECTORY,
  readSeedControlFiles,
} from "./csrm-seed-control-files.mjs";

const root = process.cwd();
const read = (...parts) => readFileSync(join(root, ...parts), "utf8");
// The catalogues the seed loads and its title file, from the seed's own declarations (no second list).
const { catalogueFiles: CONTROL_REFERENCE_FILES, titleFile: CONTROL_TITLE_FILE } =
  readSeedControlFiles(root);
const CONTROL_REFERENCE_DIRECTORY = CONTROL_DIRECTORY;
const EXPECTED_CONTROL_COUNT = 2_646;
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};
const isNonBlankString = (value) =>
  typeof value === "string" && value.trim().length > 0;
const assertUniqueIds = (items, label) => {
  const ids = items.map((item) => item.id);
  assert(new Set(ids).size === ids.length, `${label} IDs must be unique`);
};

const catalogue = JSON.parse(
  read(
    "apps",
    "backend",
    "src",
    "bootstrap",
    "idambox-csrm-role-function-api-catalogue.json",
  ),
);
const seedSource = read(
  "apps",
  "backend",
  "src",
  "bootstrap",
  "seed-csrm-data.ts",
);
const packageJson = JSON.parse(read("package.json"));

const actualControlReferenceFiles = readdirSync(
  join(root, ...CONTROL_REFERENCE_DIRECTORY),
  { withFileTypes: true },
)
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .sort();
const expectedControlReferenceFiles = [
  ...CONTROL_REFERENCE_FILES,
  CONTROL_TITLE_FILE,
].sort();

assert(
  JSON.stringify(actualControlReferenceFiles) ===
    JSON.stringify(expectedControlReferenceFiles),
  `Control files must be exactly the ${CONTROL_REFERENCE_FILES.length} catalogues the seed loads and its title file ${CONTROL_TITLE_FILE}, found: ${actualControlReferenceFiles.join(", ")}`,
);

const controlTitleFile = JSON.parse(
  read(...CONTROL_REFERENCE_DIRECTORY, CONTROL_TITLE_FILE),
);
assert(
  controlTitleFile &&
    typeof controlTitleFile.titles === "object" &&
    Object.keys(controlTitleFile.titles).every((referenceFile) =>
      CONTROL_REFERENCE_FILES.includes(referenceFile),
    ),
  `${CONTROL_TITLE_FILE} must title only controls of the catalogues the seed loads`,
);

const allControlIds = [];
let totalControlCount = 0;

for (const referenceFile of CONTROL_REFERENCE_FILES) {
  const referenceCatalogue = JSON.parse(
    read(...CONTROL_REFERENCE_DIRECTORY, referenceFile),
  );

  assert(
    Array.isArray(referenceCatalogue.controls),
    `${referenceFile} must define a controls array`,
  );
  assert(
    Number.isInteger(referenceCatalogue.controlCount),
    `${referenceFile} must declare an integer controlCount`,
  );
  assert(
    referenceCatalogue.controlCount === referenceCatalogue.controls.length,
    `${referenceFile} declares ${referenceCatalogue.controlCount} controls but contains ${referenceCatalogue.controls.length}`,
  );

  const catalogueControlIds = referenceCatalogue.controls.map(
    (control, index) => {
      assert(
        control && typeof control === "object" && !Array.isArray(control),
        `${referenceFile} control at index ${index} must be an object`,
      );
      assert(
        isNonBlankString(control.id),
        `${referenceFile} control at index ${index} must have a nonblank ID`,
      );

      return control.id.trim();
    },
  );

  assert(
    new Set(catalogueControlIds).size === catalogueControlIds.length,
    `${referenceFile} control IDs must be unique`,
  );

  allControlIds.push(...catalogueControlIds);
  totalControlCount += referenceCatalogue.controls.length;
}

assert(
  totalControlCount === EXPECTED_CONTROL_COUNT,
  `Expected exactly ${EXPECTED_CONTROL_COUNT} controls, found ${totalControlCount}`,
);
assert(
  new Set(allControlIds).size === allControlIds.length,
  "Control reference IDs must be globally unique",
);

assertUniqueIds(catalogue.roles, "Role");
assertUniqueIds(catalogue.functions, "Function");
assertUniqueIds(catalogue.functionApis, "FunctionApi");

const functionIds = new Set(catalogue.functions.map((item) => item.id));
const functionApiIds = new Set(catalogue.functionApis.map((item) => item.id));
const roleIds = new Set(catalogue.roles.map((item) => item.id));
for (const role of catalogue.roles) {
  for (const functionId of role.functionIds) {
    assert(
      functionIds.has(functionId),
      `Role ${role.id} references missing Function ${functionId}`,
    );
  }
}
for (const platformFunction of catalogue.functions) {
  for (const roleId of platformFunction.roleIds ?? []) {
    assert(
      roleIds.has(roleId),
      `Function ${platformFunction.id} references missing Role ${roleId}`,
    );
  }
  const roleSideRoleIds = catalogue.roles
    .filter((role) => role.functionIds.includes(platformFunction.id))
    .map((role) => role.id)
    .sort();
  const functionSideRoleIds = [...(platformFunction.roleIds ?? [])].sort();
  assert(
    JSON.stringify(functionSideRoleIds) === JSON.stringify(roleSideRoleIds),
    `Function ${platformFunction.id} Role membership must match Role.functionIds`,
  );
  for (const functionApiId of platformFunction.functionApiIds ?? []) {
    assert(
      functionApiIds.has(functionApiId),
      `Function ${platformFunction.id} references missing FunctionApi ${functionApiId}`,
    );
  }
  const apiSideFunctionApiIds = catalogue.functionApis
    .filter((functionApi) => functionApi.functionId === platformFunction.id)
    .map((functionApi) => functionApi.id)
    .sort();
  const functionSideFunctionApiIds = [
    ...(platformFunction.functionApiIds ?? []),
  ].sort();
  assert(
    JSON.stringify(functionSideFunctionApiIds) ===
      JSON.stringify(apiSideFunctionApiIds),
    `Function ${platformFunction.id} FunctionApi membership must match FunctionApi.functionId`,
  );
}
for (const functionApi of catalogue.functionApis) {
  assert(
    functionIds.has(functionApi.functionId),
    `FunctionApi ${functionApi.id} references missing Function ${functionApi.functionId}`,
  );
}

const roleByName = new Map(catalogue.roles.map((role) => [role.name, role]));
const securityAnalyst = roleByName.get("Security Analyst");
const securityAnalystAgent = roleByName.get("Security Analyst Agent");
const requestor = roleByName.get("Requestor");
assert(securityAnalyst, "Security Analyst must be present in the catalogue");
assert(
  securityAnalystAgent,
  "Security Analyst Agent must be present in the catalogue",
);
assert(requestor, "Requestor must remain present in the catalogue");
assert(
  securityAnalyst.functionIds.length > 0,
  "Security Analyst must have at least one Function grant",
);
// The agent holds a subset of the human analyst's grants by the catalogue's design (administration,
// release and other human-only Functions are withheld; AI output is advisory), so it never holds more.
assert(
  securityAnalystAgent.functionIds.every((functionId) =>
    securityAnalyst.functionIds.includes(functionId),
  ),
  "Security Analyst Agent must hold no Function grant that Security Analyst lacks",
);

assert(
  seedSource.includes('process.env.IDAMBOX_SEED_CSRM !== "true"'),
  "CSRM seed must retain the independent IDAMBOX_SEED_CSRM guard",
);
assert(
  /strapi\.documents\(\s*["']api::csrm-control\.csrm-control["']\s*\)/.test(
    seedSource,
  ),
  "CSRM seed must use the CSRM Control document service",
);
assert(
  seedSource.includes("controlCount !== controls.length"),
  "CSRM seed must validate each declared control count",
);
const seedFunctionSource = seedSource.slice(
  seedSource.indexOf("export async function seedCsrmData"),
);
const loadControlCataloguesIndex = seedFunctionSource.indexOf(
  "await readControlLibrary(strapi.dirs.app.root)",
);
const seedControlsIndex = seedFunctionSource.indexOf(
  "await seedCsrmControls(strapi, controlSeeds",
);
assert(
  loadControlCataloguesIndex >= 0 &&
    seedControlsIndex >= 0 &&
    loadControlCataloguesIndex < seedControlsIndex,
  "CSRM seed must load and validate control catalogues before seeding controls",
);
assert(
  !/\bcontrolType\s*:/.test(seedSource),
  "CSRM seed must not map a source type into controlType",
);
assert(
  seedSource.includes('const CSRM_APPLICATION_SLUG = "idambox-csrm"'),
  "CSRM seed must use the canonical application slug",
);
assert(
  seedSource.includes("applicationService.create"),
  "CSRM seed must create its canonical Application when absent",
);
assert(
  seedSource.includes("applicationService.findMany"),
  "CSRM seed must look up the canonical Application before creating it",
);
assert(
  !seedSource.includes("IDAMBOX_SEED_CORE=true"),
  "CSRM seed must not require the core seed flag",
);
assert(
  !seedSource.includes("api::application-role"),
  "CSRM seed must retain the accepted Function-based authorization model",
);
assert(
  seedSource.includes("roles: []"),
  "CSRM seed must keep Jane role-free on creation and update",
);
assert(
  seedSource.includes("roles: [securityAnalystRole.documentId]"),
  "CSRM seed must assign Bob only to Security Analyst",
);
assert(
  packageJson.scripts?.["verify:csrm-seed"] ===
    "node scripts/verify-csrm-seed.mjs && node scripts/verify-csrm-seed-runtime.mjs",
  "verify:csrm-seed must run static verification before the runtime verifier",
);

console.log("IdamBox CSRM seed catalogue verification passed");
