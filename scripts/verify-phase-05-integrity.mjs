import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const phaseDirectory = join(root, '.planning', 'phases', '05-risk-register-and-mitigation-management');
const expectedCatalogueHash = 'A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89';
const diagnostics = [];

function fail(name, detail) {
  diagnostics.push({ name, ok: false, detail });
}

function pass(name, detail) {
  diagnostics.push({ name, ok: true, detail });
}

function git(args, options = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function findPhaseBase() {
  const summaries = readdirSync(phaseDirectory)
    .filter((name) => /^05-\d+-SUMMARY\.md$/.test(name))
    .sort();
  const candidates = new Set();
  for (const summary of summaries) {
    const content = readFileSync(join(phaseDirectory, summary), 'utf8');
    const section = content.match(/## Task Commits[\s\S]*?(?=\n## |$)/)?.[0] ?? '';
    for (const match of section.matchAll(/`([0-9a-f]{7,40})`/gi)) {
      const resolved = git(['rev-parse', '--verify', `${match[1]}^{commit}`]);
      candidates.add(resolved);
    }
  }
  const history = git(['rev-list', '--reverse', 'HEAD']).split(/\r?\n/);
  const oldest = history.find((commit) => candidates.has(commit));
  if (!oldest) throw new Error('no attributable task commit could be resolved from Phase 5 summaries');
  return oldest;
}

function listFiles(directory, predicate = () => true) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path, predicate) : predicate(path) ? [path] : [];
  });
}

function repoPath(path) {
  return relative(root, path).split(sep).join('/');
}

function violations(files, patterns) {
  const found = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const [label, pattern] of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) found.push(`${repoPath(file)} (${label})`);
    }
  }
  return found;
}

let phaseBase;
try {
  phaseBase = findPhaseBase();
  pass('phase range', `${phaseBase.slice(0, 7)}^..HEAD`);
} catch (error) {
  fail('phase range', error.message);
}

const branch = git(['branch', '--show-current']);
branch === 'dylan-test' ? pass('branch', branch) : fail('branch', `expected dylan-test, received ${branch || 'detached HEAD'}`);
process.version === 'v24.19.0' ? pass('Node runtime', process.version) : fail('Node runtime', `expected v24.19.0, received ${process.version}`);

let changedPaths = [];
if (phaseBase) {
  changedPaths = git(['diff', '--name-only', `${phaseBase}^`]).split(/\r?\n/).filter(Boolean);
  const forbiddenChanges = changedPaths.filter((path) =>
    /(^|\/)package\.json$/.test(path)
    || /(^|\/)pnpm-lock\.yaml$/.test(path)
    || path === 'apps/strapi/src/api/csrm-risk/content-types/csrm-risk/schema.json'
    || path === 'apps/strapi/src/api/csrm-control-implementation/content-types/csrm-control-implementation/schema.json');
  forbiddenChanges.length === 0
    ? pass('immutable package and schema paths', `${changedPaths.length} changed paths inspected`)
    : fail('immutable package and schema paths', forbiddenChanges.join(', '));
}

const cataloguePaths = [
  'docs/references/idambox-csrm-role-function-api-catalogue.json',
  'apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json',
];
const catalogueBuffers = cataloguePaths.map((path) => readFileSync(join(root, path)));
const catalogueHashes = catalogueBuffers.map((buffer) => createHash('sha256').update(buffer).digest('hex').toUpperCase());
catalogueBuffers[0].equals(catalogueBuffers[1])
  ? pass('catalogue byte identity', 'both catalogue copies are identical')
  : fail('catalogue byte identity', 'catalogue copies differ');
catalogueHashes.every((hash) => hash === expectedCatalogueHash)
  ? pass('catalogue SHA-256', expectedCatalogueHash)
  : fail('catalogue SHA-256', catalogueHashes.join(', '));

const publicPermissions = read('apps/strapi/src/bootstrap/reconcile-development-public-permissions.ts');
const publicRiskActions = [
  'api::csrm-risk.csrm-risk.listRisks',
  'api::csrm-risk.csrm-risk.getRisk',
].filter((action) => publicPermissions.includes(`"${action}"`) || publicPermissions.includes(`'${action}'`));
publicRiskActions.length === 0
  ? pass('public-role Risk reads', 'neither Risk register read is exposed through users-permissions')
  : fail('public-role Risk reads', publicRiskActions.join(', '));

const sourceExtensions = /\.(?:[cm]?[jt]sx?)$/;
const riskProductionFiles = [
  ...listFiles(join(root, 'apps', 'web', 'src', 'features', 'risks'), (path) => sourceExtensions.test(path)),
  ...listFiles(join(root, 'apps', 'web', 'app', '(app)', 'app', 'risks'), (path) => sourceExtensions.test(path)),
];
const phaseTestFiles = [
  ...listFiles(join(root, 'apps', 'web', 'e2e'), (path) => /risk-register.*\.spec\.ts$/.test(path)),
  ...listFiles(join(root, 'apps', 'web', 'src', 'features', 'risks'), (path) => /\.test\.[jt]sx?$/.test(path)),
  ...listFiles(join(root, 'apps', 'strapi', 'tests'), (path) => /risk-register|contract-catalogue/.test(path) && sourceExtensions.test(path)),
];
const harnessFiles = [join(root, 'apps', 'web', 'playwright.config.ts'), ...phaseTestFiles];

const escapeViolations = violations(phaseTestFiles, [
  ['focused/skipped test call', /\b(?:test|it|describe)\s*\.\s*(?:only|skip|fixme)\s*\(/],
  ['Phase 5 RED switch', /PHASE5_RED/],
  ['runtime argument escape', /execArgv/],
  ['focused expectation escape', /expectsFocused/],
  ['conditional file guard', /existsSync\s*\([^)]*\)\s*\)?\s*(?:\{|&&)[\s\S]{0,160}\breturn\b/],
  ['environment test bypass', /process\.env\.[A-Z0-9_]*(?:SKIP|BYPASS|FOCUS|RED)[A-Z0-9_]*/],
]);
escapeViolations.length === 0
  ? pass('test anti-escape scan', `${phaseTestFiles.length} Phase 5 tests inspected`)
  : fail('test anti-escape scan', escapeViolations.join(', '));

const fetchViolations = violations(riskProductionFiles, [['raw fetch', /\bfetch\s*\(/]]);
fetchViolations.length === 0 ? pass('typed Risk transport', 'no raw fetch in Risk pages/features') : fail('typed Risk transport', fetchViolations.join(', '));

const featureTsx = riskProductionFiles.filter((path) => path.endsWith('.tsx'));
const colourViolations = violations(featureTsx, [['literal colour', /(?:#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\s*\()/i]]);
colourViolations.length === 0 ? pass('semantic Risk colours', 'no literal colours in Risk feature TSX') : fail('semantic Risk colours', colourViolations.join(', '));

const livePortViolations = violations(harnessFiles, [['live port', /(?:127\.0\.0\.1|localhost):(?:1337|3000)\b/]]);
livePortViolations.length === 0 ? pass('isolated E2E ports', 'no executable live-port references') : fail('isolated E2E ports', livePortViolations.join(', '));

if (phaseBase) {
  const commitMessages = git(['log', '--format=%B', `${phaseBase}^..HEAD`]);
  const diff = git(['diff', '--unified=0', `${phaseBase}^`, '--', '.', ':(exclude).planning/**', ':(exclude)scripts/verify-phase-05-integrity.mjs']);
  const addedContent = diff.split(/\r?\n/).filter((line) => line.startsWith('+') && !line.startsWith('+++')).join('\n');
  const attributionPattern = /(?:co-authored-by\s*:.*(?:openai|anthropic|chatgpt|claude|codex)|generated (?:by|with) (?:ai|chatgpt|claude|codex))/i;
  attributionPattern.test(`${commitMessages}\n${addedContent}`)
    ? fail('AI attribution', 'attribution marker found in Phase 5 commits or added source')
    : pass('AI attribution', 'no attribution marker found');
}

const pnpmCli = join(dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'pnpm.js');
const apiCheck = spawnSync(process.execPath, [pnpmCli, '--filter', '@csrm/web', 'api:check'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
if (apiCheck.status === 0) {
  pass('generated API contract', 'api:check passed');
} else {
  fail('generated API contract', `${apiCheck.stdout}\n${apiCheck.stderr}`.trim());
}

for (const diagnostic of diagnostics) {
  console.log(`${diagnostic.ok ? 'PASS' : 'FAIL'} ${diagnostic.name}: ${diagnostic.detail}`);
}
if (diagnostics.some(({ ok }) => !ok)) process.exitCode = 1;
