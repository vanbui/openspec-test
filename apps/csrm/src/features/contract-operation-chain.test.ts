import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The static chain guard (D-04, D-06).
 *
 * Every call the web makes through the generated openapi-fetch client names a
 * literal contract path; that operation exists in
 * docs/references/specification.json; Strapi mounts it exactly once, as
 * docs/references/served-operations.json records from the running server; and
 * the catalogue grants it (or the inventory allow-lists it with a reason). No
 * module outside the transport calls fetch, and every service module is
 * server-only. The inventory's web-called set and this scan must agree, so an
 * operation the web starts or stops calling changes the inventory deliberately
 * (SERVED_OPERATIONS_WRITE=1 pnpm --filter @csrm/strapi served-operations:write).
 *
 * The scan reads every module of the web source, not only the feature services,
 * and every HTTP-method call whatever its receiver is named (SR-03): the
 * generated client is the only object in the web source with those members. A
 * method taken off the client into a binding of its own, or reached by a
 * computed key, would hide its call, so both are refused. Only the feature
 * services and the transport may build or name the client at all. The Strapi
 * inventory's caller scan (served-operations.integration.test.ts) reads the web
 * the same way.
 */

const webDir = process.cwd();
const repositoryDir = resolve(webDir, '..', '..');
const TRANSPORT_DIRECTORY = 'src/lib/api/transport';
// A type argument (`client.GET<T>(`, nested or not) or a space before the parenthesis cannot hide a call (O-1).
const METHOD_CALL = /\.(GET|POST|PUT|PATCH|DELETE)\s*(?:<[^()]*>)?\s*\(\s*([^,)]+)/g;
const DETACHED_METHOD = [
  /\b(?:const|let|var)\s*\{[^}]*\b(?:GET|POST|PUT|PATCH|DELETE)\b[^}]*\}\s*=/,
  /\[\s*(['"`])(?:GET|POST|PUT|PATCH|DELETE)\1\s*\]/,
];
const CLIENT_HANDLE = /\bcreateStrapiClient\b|\bStrapiClient\b|['"]openapi-fetch['"]/;
const PATH_CONSTANT = /const (\w+) = '(\/[^']+)'(?: as const)?;/g;
const FETCH_CALL = /\bfetch\(/;
const IMPORT_OPERATIONS = ['risk_types', 'controls', 'information_systems', 'information_assets'].flatMap((collection) => [
  `POST /v1/${collection}/import/preview`,
  `POST /v1/${collection}/import`,
]);

type JsonObject = Record<string, any>;
type WebCall = { file: string; method: string; path: string };
type ServedRow = { catalogueUrl: string; functionApiIds: string[]; roleIds: string[]; webCallers?: string[] };
type UncataloguedRow = { method: string; path: string; reason: string };
type Inventory = { served: ServedRow[]; uncatalogued: UncataloguedRow[] };

const specification = JSON.parse(readFileSync(resolve(repositoryDir, 'docs/references/specification.json'), 'utf8')) as JsonObject;
const inventory = JSON.parse(readFileSync(resolve(repositoryDir, 'docs/references/served-operations.json'), 'utf8')) as Inventory;

const toPosix = (file: string): string => relative(webDir, file).split(sep).join('/');
const isTestFile = (file: string): boolean => /\.test\.tsx?$/.test(file);

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** Every module of the web source: app/ and src/, and the files beside them, tests and declarations excepted. */
function sourceModules(): string[] {
  const nested = [resolve(webDir, 'src'), resolve(webDir, 'app')].flatMap((root) => walk(root));
  const beside = readdirSync(webDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => resolve(webDir, entry.name));
  return [...nested, ...beside].filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts') && !isTestFile(file)).sort();
}

const isServiceLayer = (file: string): boolean =>
  (file.startsWith('src/features/') && file.endsWith('-service.ts')) || file.startsWith(`${TRANSPORT_DIRECTORY}/`);

/** The modules that hold the client: every feature service and the transport. */
function serviceModules(): string[] {
  return sourceModules().filter((file) => isServiceLayer(toPosix(file)));
}

function scanCalls(): { calls: WebCall[]; nonLiteral: string[]; detached: string[] } {
  const calls: WebCall[] = [];
  const nonLiteral: string[] = [];
  const detached: string[] = [];
  for (const file of sourceModules()) {
    const source = readFileSync(file, 'utf8');
    if (DETACHED_METHOD.some((pattern) => pattern.test(source))) detached.push(`CLIENT_METHOD_DETACHED ${toPosix(file)}`);
    const constants = new Map([...source.matchAll(PATH_CONSTANT)].map((match) => [match[1], match[2]] as const));
    for (const [, method, argument] of source.matchAll(METHOD_CALL)) {
      const trimmed = argument.trim();
      const path = trimmed.startsWith("'") && trimmed.endsWith("'") ? trimmed.slice(1, -1) : constants.get(trimmed);
      if (path === undefined) {
        nonLiteral.push(`NON_LITERAL_CLIENT_PATH ${toPosix(file)}: ${trimmed}`);
        continue;
      }
      calls.push({ file: toPosix(file), method, path });
    }
  }
  return { calls, nonLiteral, detached };
}

/** The catalogue form of a web call: `METHOD:/api/<contract path>`. */
const catalogueUrl = (call: Pick<WebCall, 'method' | 'path'>): string => `${call.method}:/api${call.path}`;
const operationKey = (call: Pick<WebCall, 'method' | 'path'>): string => `${call.method} ${call.path}`;
/** Parameter names replaced by an empty placeholder, so two URLs compare by position. */
const positional = (url: string): string => url.replace(/\{[^}]+\}/g, '{}');

function servedRowFor(call: Pick<WebCall, 'method' | 'path'>): ServedRow | undefined {
  const url = catalogueUrl(call);
  return inventory.served.find((row) => row.catalogueUrl === url)
    ?? inventory.served.find((row) => positional(row.catalogueUrl) === positional(url));
}

/** The web-called operations, each with the modules that call it, from one side of the chain. */
function callersByOperation(entries: ReadonlyArray<{ key: string; file: string }>): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const { key, file } of entries) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(file);
  }
  return new Map([...map].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)).map(([key, files]) => [key, [...files].sort()]));
}

const scan = scanCalls();
const distinctCalls = [...new Map(scan.calls.map((call) => [operationKey(call), call])).values()];

describe('contract operation chain', () => {
  it('names every client call with a literal contract path', () => {
    expect(scan.nonLiteral).toEqual([]);
    expect(scan.calls.length).toBeGreaterThan(60);
  });

  it('lets only the feature services and the transport build or name the generated client', () => {
    const outside = sourceModules()
      .map(toPosix)
      .filter((file) => !isServiceLayer(file))
      .filter((file) => CLIENT_HANDLE.test(readFileSync(resolve(webDir, file), 'utf8')))
      .map((file) => `CLIENT_OUTSIDE_SERVICE_LAYER ${file}`);
    expect(outside).toEqual([]);
  });

  it('never takes a method off the client, where the scan could not see its call', () => {
    expect(scan.detached).toEqual([]);
  });

  it('scans every web source module, whatever the receiver of a call is named', () => {
    const modules = sourceModules().map(toPosix);
    expect(modules).toEqual(expect.arrayContaining(['app/layout.tsx', 'app/sign-in/page.tsx', 'proxy.ts', 'src/lib/api/transport/server-client.ts']));
    expect(modules.every((file) => !isTestFile(file) && !file.endsWith('.d.ts'))).toBe(true);
    expect('const strapi = await createStrapiClient(); strapi.GET(\'/applications\');'.match(METHOD_CALL)).toEqual([".GET('/applications'"]);
  });

  it('recognises a call whatever sits between the method and its arguments (O-1)', () => {
    // A generic type argument, nested or not, or a space before the parenthesis, must not hide a call.
    const calls = (source: string) => [...source.matchAll(METHOD_CALL)].map(([, method, argument]) => `${method} ${argument.trim()}`);
    expect(calls("client.GET<RiskResponse>('/v1/risks', options);")).toEqual(["GET '/v1/risks'"]);
    expect(calls("client.POST<Paged<Risk>>('/v1/risks', options);")).toEqual(["POST '/v1/risks'"]);
    expect(calls("client.PATCH ('/v1/risks/{riskId}', options);")).toEqual(["PATCH '/v1/risks/{riskId}'"]);
    expect(calls("client.DELETE <never> ( RISK_PATH );")).toEqual(['DELETE RISK_PATH']);
  });

  it('calls only documented, served and catalogued operations', () => {
    const failures: string[] = [];
    for (const call of distinctCalls) {
      const key = operationKey(call);
      if (specification.paths?.[call.path]?.[call.method.toLowerCase()] === undefined) failures.push(`NOT_IN_SPEC ${key}`);
      const row = servedRowFor(call);
      if (row === undefined) {
        failures.push(`NOT_SERVED ${key}`);
        continue;
      }
      const allowListed = inventory.uncatalogued.some((entry) => `${entry.method}:${entry.path}` === `${call.method}:/api${call.path}`);
      if (row.functionApiIds.length === 0 && !allowListed) failures.push(`NOT_CATALOGUED ${key}`);
    }
    expect(failures).toEqual([]);
  });

  it('agrees with the served-operations inventory about which operations the web calls, and from where', () => {
    const fromWeb = callersByOperation(scan.calls.map((call) => ({ key: catalogueUrl(call), file: call.file })));
    const fromInventory = callersByOperation(
      inventory.served.flatMap((row) => (row.webCallers ?? []).map((file) => ({ key: row.catalogueUrl, file }))),
    );
    expect([...fromWeb]).toEqual([...fromInventory]);
  });

  it('keeps every fetch inside the transport and every service module server-only', () => {
    const outsideTransport = [resolve(webDir, 'src'), resolve(webDir, 'app')]
      .flatMap((root) => walk(root))
      .filter((file) => /\.tsx?$/.test(file) && !isTestFile(file))
      .map(toPosix)
      .filter((file) => !file.startsWith(`${TRANSPORT_DIRECTORY}/`))
      .filter((file) => FETCH_CALL.test(readFileSync(resolve(webDir, file), 'utf8')))
      .map((file) => `FETCH_OUTSIDE_TRANSPORT ${file}`);
    expect(outsideTransport).toEqual([]);

    const notServerOnly = serviceModules()
      .filter((file) => !readFileSync(file, 'utf8').trimStart().startsWith("import 'server-only';"))
      .map((file) => `SERVICE_MODULE_NOT_SERVER_ONLY ${toPosix(file)}`);
    expect(notServerOnly).toEqual([]);
  });

  it('calls the eight CSV import operations through the contract, served for the human Security Analyst only (D-06)', () => {
    expect(IMPORT_OPERATIONS).toHaveLength(8);
    for (const key of IMPORT_OPERATIONS) {
      const [method, path] = key.split(' ');
      const callers = scan.calls.filter((call) => call.method === method && call.path === path).map((call) => call.file);
      expect(callers, key).toEqual(['src/features/administration/administration-service.ts']);
      const row = servedRowFor({ method, path });
      expect(row?.roleIds, key).toEqual(['role.security_analyst']);
      expect(row?.webCallers, key).toEqual(['src/features/administration/administration-service.ts']);
    }
  });
});
