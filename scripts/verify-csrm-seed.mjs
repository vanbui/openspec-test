import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const read = (...parts) => readFileSync(join(root, ...parts), "utf8");

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertIncludes = (source, value, label) => {
  assert(source.includes(value), `${label} must include ${value}`);
};

const assertBefore = (source, first, second, label) => {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);

  assert(firstIndex >= 0, `${label} missing ${first}`);
  assert(secondIndex >= 0, `${label} missing ${second}`);
  assert(
    firstIndex < secondIndex,
    `${label} must use ${first} before ${second}`,
  );
};

const seedSource = read(
  "apps",
  "backend",
  "src",
  "bootstrap",
  "seed-csrm-data.ts",
);
const coreSeedSource = read(
  "apps",
  "backend",
  "src",
  "bootstrap",
  "seed-core-data.ts",
);
const bootstrapSource = read("apps", "backend", "src", "index.ts");
const envExample = read("apps", "backend", ".env.example");
const backendReadme = read("apps", "backend", "README.md");
const packageJson = JSON.parse(read("package.json"));

const requiredCsrmSeedValues = [
  "IDAMBOX_SEED_CSRM",
  "jane.doe@idambox.com",
  'username: "jane.doe"',
  "bob.doe@idambox.com",
  'username: "bob.doe"',
];

for (const value of requiredCsrmSeedValues) {
  assertIncludes(seedSource, value, "CSRM seed source");
}

assertIncludes(
  seedSource,
  'const CSRM_SECURITY_ANALYST_ROLE_NAME = "Security Analyst"',
  "CSRM security analyst role name",
);
assertIncludes(
  coreSeedSource,
  "IdamBox CSRM",
  "Core seed CSRM application name",
);

assertIncludes(
  seedSource,
  "process.env.IDAMBOX_SEED_CSRM !==",
  "CSRM seed guard",
);
assertIncludes(
  seedSource,
  "idambox-csrm-role-function-api-catalogue.json",
  "CSRM catalogue import",
);
assertIncludes(seedSource, "api::application.application", "Application document service");
assertIncludes(seedSource, "api::function.function", "Function document service");
assertIncludes(
  seedSource,
  "api::function-api.function-api",
  "FunctionApi document service",
);
assertIncludes(seedSource, "api::role.role", "Role document service");
assertIncludes(
  seedSource,
  "api::idambox-user.idambox-user",
  "IdamBox User document service",
);
assertIncludes(
  seedSource,
  "IDAMBOX_SEED_CORE=true",
  "Core seed prerequisite message",
);

assertBefore(
  seedSource,
  "existingJaneUsers",
  "userService.create",
  "Jane idempotency",
);

const bobUserBlock = seedSource.slice(seedSource.indexOf("existingBobUsers"));
assertBefore(
  bobUserBlock,
  "existingBobUsers",
  "userService.create",
  "Bob idempotency",
);

assertIncludes(seedSource, "$eq: CSRM_USERS.jane.email", "Jane lookup");
assertIncludes(seedSource, "$eq: CSRM_USERS.bob.email", "Bob lookup");
assertIncludes(seedSource, "data: CSRM_USERS.jane", "Jane update data");
assertIncludes(seedSource, "...CSRM_USERS.bob", "Bob update data");
assertIncludes(
  seedSource,
  "roles: [securityAnalystRole.documentId]",
  "Bob Role relation",
);

const janeSeedDataBlock = seedSource.slice(
  seedSource.indexOf("jane:"),
  seedSource.indexOf("bob:"),
);
assert(
  !janeSeedDataBlock.includes("roles"),
  "Jane seed data must not include roles",
);

assertIncludes(coreSeedSource, "IdamBox CSRM", "Core seed CSRM application");
assertIncludes(coreSeedSource, "idambox-csrm", "Core seed CSRM slug");
assert(
  !coreSeedSource.includes("api::function.function") &&
    !coreSeedSource.includes("api::role.role"),
  "Core seed must not create functions or roles",
);

assertIncludes(bootstrapSource, "seed-csrm-data", "Bootstrap import");
assertIncludes(
  bootstrapSource,
  "await seedCoreData(strapi);",
  "Core seed call",
);
assertIncludes(
  bootstrapSource,
  "await seedCsrmData(strapi);",
  "CSRM seed call",
);

assertIncludes(envExample, "IDAMBOX_SEED_CORE=", "Environment example");
assertIncludes(envExample, "IDAMBOX_SEED_CSRM=", "Environment example");

assertIncludes(backendReadme, "IDAMBOX_SEED_CSRM=true", "Backend README");
assertIncludes(backendReadme, "IDAMBOX_SEED_CORE", "Backend README");
assertIncludes(backendReadme, "FunctionApi", "Backend README");

assert(
  packageJson.scripts?.["verify:csrm-seed"] ===
    "node scripts/verify-csrm-seed.mjs",
  "package.json must define verify:csrm-seed",
);

console.log("IdamBox CSRM seed verification passed");
