import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const phaseDirectory = join(root, '.planning', 'phases', '06-administration-and-csv-imports');
const diagnostics = [];
const frozenSchemas = new Map([
  ['apps/backend/src/api/csrm-risk-type/content-types/csrm-risk-type/schema.json', 'DCD3BF389CE79D992CAB7E97692C883BB5E769FEADF2F5159DDCEC5BF16F2921'],
  ['apps/backend/src/api/csrm-control/content-types/csrm-control/schema.json', 'C37151CCAE3C798BC128AB4902AB85D12914C76C922D48F67F32C92DA7011F30'],
  ['apps/backend/src/api/csrm-information-system/content-types/csrm-information-system/schema.json', 'CD1636590493BD2AB35DEF7B040E940EFD2918976137FE5EEAD3029B192E0C53'],
  ['apps/backend/src/api/csrm-information-asset/content-types/csrm-information-asset/schema.json', 'E0DA75DCE74AD4E90DB52B8C44F1391B1DA5A6BC457922E31E351F61CB3DDAC5'],
]);

function report(ok, name, detail) {
  diagnostics.push({ ok, name, detail });
}

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function read(repoPath) {
  return readFileSync(join(root, repoPath), 'utf8');
}

function repoPath(filename) {
  return relative(root, filename).split(sep).join('/');
}

function listFiles(directory, predicate = () => true) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(filename, predicate) : predicate(filename) ? [filename] : [];
  });
}

function violations(files, patterns) {
  const found = [];
  for (const filename of files) {
    const content = readFileSync(filename, 'utf8');
    for (const [label, pattern] of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) found.push(`${repoPath(filename)} (${label})`);
    }
  }
  return found;
}

function routeBlocks(source) {
  return source.match(/^\s{4}\{[\s\S]*?^\s{4}\},?$/gm) ?? [];
}

function routeHasTokenGate(source, routePath) {
  const block = routeBlocks(source).find((candidate) => new RegExp(`\\bpath:\\s*["']${routePath.replaceAll('/', '\\/')}["']`).test(candidate));
  return Boolean(block && /\bauth:\s*\{\s*strategies:\s*\[\s*["']content-api-token["']\s*\]/.test(block));
}

function countRouteTokenGates(source) {
  return routeBlocks(source).filter((block) => /\bauth:\s*\{\s*strategies:\s*\[\s*["']content-api-token["']\s*\]/.test(block)).length;
}

function findPhaseBase() {
  const candidates = new Set();
  for (const summary of readdirSync(phaseDirectory).filter((name) => /^06-\d+-SUMMARY\.md$/.test(name))) {
    const content = readFileSync(join(phaseDirectory, summary), 'utf8');
    for (const match of content.matchAll(/`([0-9a-f]{7,40})`/gi)) {
      const resolved = git(['rev-parse', '--verify', `${match[1]}^{commit}`]);
      candidates.add(resolved);
    }
  }
  const history = git(['log', '--reverse', '--format=%H%x09%s']).split(/\r?\n/).filter(Boolean);
  for (const line of history) {
    const [commit, subject] = line.split('\t', 2);
    if (candidates.has(commit) || /^(?:test|feat|fix|refactor|chore)\(06-/.test(subject ?? '')) return commit;
  }
  throw new Error('no attributable Phase 6 task commit could be resolved');
}

let phaseBase;
try {
  phaseBase = findPhaseBase();
  report(true, 'phase range', `${phaseBase.slice(0, 7)}^..working tree`);
} catch (error) {
  report(false, 'phase range', error.message);
}

report(process.version === 'v24.19.0', 'Node runtime', process.version);

const schemaFailures = [];
for (const [path, expected] of frozenSchemas) {
  const actual = createHash('sha256').update(readFileSync(join(root, path))).digest('hex').toUpperCase();
  if (actual !== expected) schemaFailures.push(`${path}: ${actual}`);
}
report(schemaFailures.length === 0, 'frozen content-type schemas', schemaFailures.join(', ') || 'all four hashes match');

const cataloguePaths = [
  'docs/references/idambox-csrm-role-function-api-catalogue.json',
  'apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json',
];
const catalogueBuffers = cataloguePaths.map((path) => readFileSync(join(root, path)));
report(catalogueBuffers[0].equals(catalogueBuffers[1]), 'catalogue byte identity', 'authoritative and bootstrap copies compared');
const catalogue = JSON.parse(catalogueBuffers[0].toString('utf8'));
report(catalogue.roles.length === 3 && catalogue.functions.length === 30 && catalogue.functionApis.length === 110,
  'catalogue exact counts', `${catalogue.roles.length} roles, ${catalogue.functions.length} functions, ${catalogue.functionApis.length} FunctionAPIs`);
const administrationApis = catalogue.functionApis.filter((entry) => entry.functionId.startsWith('function.administration.'));
const deleteGrants = administrationApis.filter((entry) => entry.url.startsWith('DELETE:'));
report(deleteGrants.length === 0, 'catalogue no-delete boundary', deleteGrants.map((entry) => entry.url).join(', ') || 'no Administration DELETE grant');

const requiredTests = [
  'apps/backend/tests/administration.unit.test.ts',
  'apps/backend/tests/administration.integration.test.ts',
  'apps/csrm/src/features/administration/administration-schema.test.ts',
  'apps/csrm/src/features/administration/administration-service.test.ts',
  'apps/csrm/src/features/administration/administration-workflow.test.tsx',
  'apps/csrm/e2e/administration-workflow.spec.ts',
];
const missingTests = requiredTests.filter((path) => !existsSync(join(root, path)));
report(missingTests.length === 0, 'Phase 6 test inventory', missingTests.join(', ') || `${requiredTests.length} required files present`);

const phaseTestFiles = [
  ...listFiles(join(root, 'apps', 'backend', 'tests'), (path) => /(?:administration.*|authorization\.integration)\.test\.ts$/.test(path)),
  ...listFiles(join(root, 'apps', 'csrm', 'src', 'features', 'administration'), (path) => /\.test\.tsx?$/.test(path)),
  join(root, 'apps', 'csrm', 'e2e', 'administration-workflow.spec.ts'),
];
const escapeViolations = violations(phaseTestFiles, [
  ['focused/skipped test call', /\b(?:test|it|describe)\s*\.\s*(?:only|skip|fixme)\s*\(/],
  ['focused expectation escape', /expectsFocused/],
  ['Phase 6 RED switch', /PHASE6_RED/],
  ['runtime argument escape', /execArgv/],
  ['conditional file guard', /(?:existsSync|accessSync|statSync)\s*\([^)]*\)[\s\S]{0,200}\b(?:return|skip|fixme)\b/],
  ['early-return test escape', /\b(?:test|it)\s*\([^)]*=>\s*\{\s*(?:if\s*\([^)]*\)\s*)?return\b/],
  ['environment bypass', /process\.env\.[A-Z0-9_]*(?:SKIP|BYPASS|FOCUS|RED)[A-Z0-9_]*/],
  ['tautological equality', /(?:assert\.(?:equal|deepEqual)|expect)\s*\(\s*([A-Za-z_$][\w.$]*)\s*(?:,|\)\.toEqual\()\s*\1\b/],
]);
report(escapeViolations.length === 0, 'test anti-escape scan', escapeViolations.join(', ') || `${phaseTestFiles.length} test files inspected`);

const allTestText = phaseTestFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
const missingAnchors = [
  'ADMIN-01', 'ADMIN-02', 'ADMIN-03', 'ADMIN-04',
  'T-06-01', 'T-06-02', 'T-06-03', 'T-06-04', 'T-06-05', 'T-06-06', 'T-06-07', 'T-06-08',
  '5_242_880', '5_000', '65_536', 'unchanged', 'ambiguous', 'rejected',
].filter((anchor) => !allTestText.includes(anchor));
report(missingAnchors.length === 0, 'acceptance anchor coverage', missingAnchors.join(', ') || 'ADMIN-01..04 and T-06-01..08 are named');

const harnessFiles = [join(root, 'apps', 'csrm', 'playwright.config.ts'), ...phaseTestFiles];
const livePortViolations = violations(harnessFiles, [['hard-coded live port', /(?:https?:\/\/(?:127\.0\.0\.1|localhost):)?(?:1337|3000)\b/]]);
report(livePortViolations.length === 0, 'isolated ports', livePortViolations.join(', ') || 'no executable 1337/3000 target');
const playwright = read('apps/csrm/playwright.config.ts');
report(/reuseExistingServer:\s*false/g.test(playwright) && /playwright-e2e-\$\{invocationId\}\.db/.test(playwright)
  && /playwright-next-\$\{invocationId\}/.test(playwright), 'isolated Playwright lifecycle', 'derived servers, database, and dist directory inspected');

const integrationEvidence = read('apps/backend/tests/administration.integration.test.ts');
const browserEvidence = read('apps/csrm/e2e/administration-workflow.spec.ts');
report(/countAdministrationRecords/.test(integrationEvidence) && /doesNotMatch/.test(integrationEvidence)
  && /expectDeniedWithoutDisclosure/.test(browserEvidence) && /input\[type="file"\]/.test(browserEvidence),
  'denial non-enumeration and zero-write evidence', 'mounted and browser denial assertions inspected');

const developmentGate = read('apps/backend/src/utils/development-identity-enabled.ts');
const riskSeed = read('apps/backend/src/bootstrap/seed-risk-register-workflow.ts');
const seedTest = read('apps/backend/tests/risk-register-seed.integration.test.ts');
report(/NODE_ENV\s*===\s*["']development["']/.test(developmentGate)
  && /CSRM_ENVIRONMENT\s*===\s*["']development["']/.test(developmentGate)
  && /CSRM_DEV_IDENTITY\s*===\s*["']true["']/.test(developmentGate)
  && /IDAMBOX_SEED_CSRM\s*!==\s*["']true["']/.test(riskSeed)
  && /idempotent|reconcile/i.test(seedTest),
  'development seed triple gate and idempotence', 'environment, identity, explicit seed flag, and reconciliation test inspected');

const sourceExtensions = /\.(?:[cm]?[jt]sx?)$/;
const administrationProductionFiles = [
  ...listFiles(join(root, 'apps', 'csrm', 'src', 'features', 'administration'), (path) => sourceExtensions.test(path) && !/\.test\./.test(path)),
  ...listFiles(join(root, 'apps', 'csrm', 'app', '(app)', 'app', 'admin'), (path) => sourceExtensions.test(path)),
];
const rawFetch = violations(administrationProductionFiles, [['raw fetch', /\bfetch\s*\(/]]);
report(rawFetch.length === 0, 'typed Administration transport', rawFetch.join(', ') || 'no raw fetch in feature or page code');
const facadeFiles = listFiles(join(root, 'apps', 'csrm', 'app', 'api'), (path) => /administration|risk-types|controls|information-systems|information-assets/i.test(path));
report(facadeFiles.length === 0, 'no frontend API facade', facadeFiles.map(repoPath).join(', ') || 'no Administration Route Handler');

const genericRoutePaths = [
  'apps/backend/src/api/csrm-risk-type/routes/csrm-risk-type.ts',
  'apps/backend/src/api/csrm-control/routes/csrm-control.ts',
  'apps/backend/src/api/csrm-information-system/routes/csrm-information-system.ts',
  'apps/backend/src/api/csrm-information-asset/routes/csrm-information-asset.ts',
];
const genericExposure = violations(genericRoutePaths.map((path) => join(root, path)), [
  ['generic mutation/delete route', /^\s*(?:create|update|delete)\s*:/m],
]);
report(genericExposure.length === 0, 'generic mutation/delete closure', genericExposure.join(', ') || 'no generic mutation or delete action');

const legacyCrudPaths = [
  '/csrm-risk-types', '/csrm-risk-types/{id}',
  '/csrm-controls', '/csrm-controls/{id}',
  '/csrm-information-systems', '/csrm-information-systems/{id}',
  '/csrm-information-assets', '/csrm-information-assets/{id}',
];
const specification = JSON.parse(read('docs/references/specification.json'));
const survivingLegacyPaths = legacyCrudPaths.filter((path) => Object.hasOwn(specification.paths ?? {}, path));
report(survivingLegacyPaths.length === 0, 'legacy OpenAPI CRUD removal', survivingLegacyPaths.join(', ') || 'disabled legacy CRUD families absent');
const webContractFiles = [
  ...listFiles(join(root, 'apps', 'csrm', 'src'), (path) => sourceExtensions.test(path) && !/\.test\./.test(path)),
  ...listFiles(join(root, 'apps', 'csrm', 'app'), (path) => sourceExtensions.test(path)),
];
const legacyConsumers = violations(webContractFiles, legacyCrudPaths.map((path) => [
  `legacy contract path ${path}`,
  new RegExp(`["']${path.replaceAll('/', '\\/')}(?:["'/])`),
]));
report(legacyConsumers.length === 0, 'legacy OpenAPI consumer removal', legacyConsumers.join(', ') || 'no web source consumers');
const obsoleteRedVerifierAbsent = !existsSync(join(root, 'apps', 'csrm', 'scripts', 'verify-administration-red.mjs'));
report(obsoleteRedVerifierAbsent, 'obsolete Administration RED verifier removal',
  obsoleteRedVerifierAbsent ? 'verify-administration-red.mjs is absent' : 'verify-administration-red.mjs still exists');

const adminRoutePath = join(root, 'apps', 'backend', 'src', 'api', 'csrm-administration', 'routes', 'csrm-administration.ts');
const operationPath = join(root, 'apps', 'backend', 'src', 'api', 'csrm-administration', 'operations.ts');
const riskRoutePath = join(root, 'apps', 'backend', 'src', 'api', 'csrm-risk', 'routes', 'csrm-risk.ts');
if (existsSync(adminRoutePath) && existsSync(operationPath) && existsSync(riskRoutePath)) {
  const route = readFileSync(adminRoutePath, 'utf8');
  const riskRoute = readFileSync(riskRoutePath, 'utf8');
  const operations = readFileSync(operationPath, 'utf8');
  const mountedListPaths = ['/v1/risk_types', '/v1/controls'];
  const mountedTokenGates = mountedListPaths.filter((path) => routeHasTokenGate(riskRoute, path));
  const routeCount = (route.match(/\bmethod:\s*["']/g) ?? []).length + mountedListPaths.length;
  const administrationTokenGateCount = countRouteTokenGates(route);
  const tokenGateCount = administrationTokenGateCount + mountedTokenGates.length;
  const operationCount = (operations.match(/(?:GET|POST|PATCH):\/api\/v1\//g) ?? []).length;
  report(routeCount === 24 && tokenGateCount === 24 && mountedTokenGates.length === mountedListPaths.length && operationCount === 24 && !/DELETE:/.test(operations),
    'token-only 24-operation route boundary', `${routeCount} routes, ${tokenGateCount} token gates, ${operationCount} operations`);
  const hostileFixturesRejected = mountedListPaths.every((path) => {
    const block = routeBlocks(riskRoute).find((candidate) => candidate.includes(`path: "${path}"`));
    if (!block) return false;
    const hostile = riskRoute.replace(block, block.replace('content-api-token', 'removed-token-gate'));
    return !routeHasTokenGate(hostile, path);
  });
  report(hostileFixturesRejected, 'hostile mounted token-gate fixtures', 'removing either mounted list token gate is detected');
  const firstAdministrationRoute = routeBlocks(route)[0];
  const hostileAdministrationRoute = firstAdministrationRoute
    ? `${route.replace(firstAdministrationRoute, firstAdministrationRoute.replace('content-api-token', 'removed-token-gate'))}\n// content-api-token`
    : route;
  const hostileAdministrationGateCount = countRouteTokenGates(hostileAdministrationRoute);
  report(hostileAdministrationGateCount === 21, 'hostile Administration token-gate fixture',
    'removing one route gate remains detectable even when a comment contains the token literal');
} else {
  report(false, 'token-only 24-operation route boundary', 'Phase 6 Administration operations/routes are not implemented');
}

const secretViolations = violations([...administrationProductionFiles, ...phaseTestFiles], [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['provider secret', /\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{20,}\b/],
]);
report(secretViolations.length === 0, 'secret scan', secretViolations.join(', ') || 'no credential-shaped value');

if (phaseBase) {
  const commitMessages = git(['log', '--format=%B', `${phaseBase}^..HEAD`]);
  const diff = git(['diff', '--unified=0', `${phaseBase}^`, '--', '.', ':(exclude).planning/**']);
  const added = diff.split(/\r?\n/).filter((line) => line.startsWith('+') && !line.startsWith('+++')).join('\n');
  const attribution = /(?:co-authored-by\s*:.*(?:openai|anthropic|chatgpt|claude|codex)|generated (?:by|with) (?:ai|chatgpt|claude|codex))/i;
  report(!attribution.test(`${commitMessages}\n${added}`), 'AI attribution', 'commit messages and added lines inspected');

  const dependencyFailures = [];
  for (const packagePath of ['package.json', 'apps/backend/package.json', 'apps/csrm/package.json']) {
    const beforeResult = spawnSync('git', ['show', `${phaseBase}^:${packagePath}`], { cwd: root, encoding: 'utf8' });
    if (beforeResult.status !== 0) continue;
    const before = JSON.parse(beforeResult.stdout);
    const after = JSON.parse(read(packagePath));
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'scripts']) {
      const beforeEntries = before[section] ?? {};
      const afterEntries = after[section] ?? {};
      const changed = new Set([...Object.keys(beforeEntries), ...Object.keys(afterEntries)]);
      for (const name of changed) {
        if (beforeEntries[name] === afterEntries[name]) continue;
        if (section !== 'scripts' && name === 'csv-parse' && afterEntries[name] === '7.0.2') continue;
        dependencyFailures.push(`${packagePath} ${section}.${name}`);
      }
    }
  }
  report(dependencyFailures.length === 0, 'dependency allowlist', dependencyFailures.join(', ') || 'only csv-parse@7.0.2 may change');
}

const pnpmCli = join(dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'pnpm.js');
const apiCheck = spawnSync(process.execPath, [pnpmCli, '--filter', '@csrm/web', 'api:check'], { cwd: root, encoding: 'utf8' });
report(apiCheck.status === 0, 'generated API contract', apiCheck.status === 0 ? 'api:check passed' : `${apiCheck.stdout}\n${apiCheck.stderr}`.trim());

for (const diagnostic of diagnostics) {
  console.log(`${diagnostic.ok ? 'PASS' : 'FAIL'} ${diagnostic.name}: ${diagnostic.detail}`);
}
if (diagnostics.some(({ ok }) => !ok)) process.exitCode = 1;
