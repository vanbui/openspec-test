import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

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
  assert(firstIndex < secondIndex, `${label} must use ${first} before ${second}`);
};

const seedSource = read('apps', 'backend', 'src', 'bootstrap', 'seed-csrm-data.ts');
const bootstrapSource = read('apps', 'backend', 'src', 'index.ts');
const envExample = read('apps', 'backend', '.env.example');
const backendReadme = read('apps', 'backend', 'README.md');
const packageJson = JSON.parse(read('package.json'));

const requiredValues = [
  'IDAMBOX_SEED_CSRM',
  'IdamBox CSRM',
  'idambox-csrm',
  'Cybersecurity Risk Manager',
  'Security Analyst',
  'Security Analyst Agent',
  'jane.doe@idambox.com',
  'bob.doe@idambox.com',
];

for (const value of requiredValues) {
  assertIncludes(seedSource, value, 'CSRM seed source');
}

assertIncludes(seedSource, "process.env.IDAMBOX_SEED_CSRM !== 'true'", 'CSRM seed guard');
assertIncludes(seedSource, "strapi.documents('api::application.application')", 'Application document service');
assertIncludes(
  seedSource,
  "strapi.documents('api::application-role.application-role')",
  'Application Role document service',
);
assertIncludes(seedSource, "strapi.documents('api::role.role')", 'Role document service');
assertIncludes(seedSource, "strapi.documents('api::idambox-user.idambox-user')", 'IdamBox User document service');

assertBefore(seedSource, 'applicationService.findMany', 'applicationService.create', 'Application idempotency');
assertBefore(
  seedSource,
  'applicationRoleService.findMany',
  'applicationRoleService.create',
  'Application Role idempotency',
);
assertBefore(seedSource, 'roleService.findMany', 'roleService.create', 'Role idempotency');
const janeUserBlock = seedSource.slice(seedSource.indexOf('existingJaneUsers'), seedSource.indexOf('existingBobUsers'));
const bobUserBlock = seedSource.slice(seedSource.indexOf('existingBobUsers'));

assertBefore(janeUserBlock, 'existingJaneUsers', 'userService.create', 'Jane idempotency');
assertBefore(bobUserBlock, 'existingBobUsers', 'userService.create', 'Bob idempotency');

assertIncludes(seedSource, '$eq: CSRM_APPLICATION.slug', 'Application lookup');
assertIncludes(seedSource, '$eq: roleSeed.name', 'Application Role and Role lookup');
assertIncludes(seedSource, '$eq: CSRM_USERS.jane.email', 'Jane lookup');
assertIncludes(seedSource, '$eq: CSRM_USERS.bob.email', 'Bob lookup');
assertIncludes(seedSource, 'application: application.documentId', 'Application Role relation');
assertIncludes(seedSource, 'applicationRoles: [applicationRole.documentId]', 'Reusable Role relation');
assertIncludes(seedSource, 'roles: [securityAnalystRole.documentId]', 'Bob Role relation');

const janeSeedDataBlock = seedSource.slice(seedSource.indexOf('jane:'), seedSource.indexOf('bob:'));
assert(!janeSeedDataBlock.includes('roles'), 'Jane seed data must not include roles');

assertIncludes(bootstrapSource, "import { seedCsrmData } from './bootstrap/seed-csrm-data';", 'Bootstrap import');
assertIncludes(bootstrapSource, 'await seedCoreData(strapi);', 'Core seed call');
assertIncludes(bootstrapSource, 'await seedCsrmData(strapi);', 'CSRM seed call');

assertIncludes(envExample, 'IDAMBOX_SEED_CORE=false', 'Environment example');
assertIncludes(envExample, 'IDAMBOX_SEED_CSRM=false', 'Environment example');

for (const value of requiredValues) {
  assertIncludes(backendReadme, value, 'Backend README');
}

assertIncludes(backendReadme, 'IDAMBOX_SEED_CSRM=true', 'Backend README');
assertIncludes(backendReadme, 'IDAMBOX_SEED_CORE', 'Backend README');
assertIncludes(backendReadme, 'Keycloak', 'Backend README');
assertIncludes(backendReadme, 'CSRM assessment content types', 'Backend README');
assertIncludes(backendReadme, 'CSRM Next.js application', 'Backend README');

assert(
  packageJson.scripts?.['verify:csrm-seed'] === 'node scripts/verify-csrm-seed.mjs',
  'package.json must define verify:csrm-seed',
);

console.log('IdamBox CSRM seed verification passed');
