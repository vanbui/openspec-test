import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (...parts) => readFileSync(join(root, ...parts), "utf8");
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};
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

assertUniqueIds(catalogue.roles, "Role");
assertUniqueIds(catalogue.functions, "Function");
assertUniqueIds(catalogue.functionApis, "FunctionApi");

const functionIds = new Set(catalogue.functions.map((item) => item.id));
const functionApiIds = new Set(catalogue.functionApis.map((item) => item.id));
for (const role of catalogue.roles) {
  for (const functionId of role.functionIds) {
    assert(
      functionIds.has(functionId),
      `Role ${role.id} references missing Function ${functionId}`,
    );
  }
}
for (const platformFunction of catalogue.functions) {
  for (const functionApiId of platformFunction.functionApiIds ?? []) {
    assert(
      functionApiIds.has(functionApiId),
      `Function ${platformFunction.id} references missing FunctionApi ${functionApiId}`,
    );
  }
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
assert(
  JSON.stringify([...securityAnalyst.functionIds].sort()) ===
    JSON.stringify([...securityAnalystAgent.functionIds].sort()),
  "Security Analyst Agent Function grants must exactly match Security Analyst",
);

assert(
  seedSource.includes('process.env.IDAMBOX_SEED_CSRM !== "true"'),
  "CSRM seed must retain the independent IDAMBOX_SEED_CSRM guard",
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
