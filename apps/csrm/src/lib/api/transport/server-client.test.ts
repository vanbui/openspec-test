import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createStrapiClient, normalizeTransportError } from './server-client';

const originalBaseUrl = process.env.CSRM_API_BASE_URL;
const originalDevelopmentIdentity = process.env.CSRM_DEV_IDENTITY;
const originalApiToken = process.env.CSRM_API_TOKEN;
const originalNodeEnvironment = process.env.NODE_ENV;
const runtimeVariables = ['CSRM_E2E_RUNTIME_ROOT', 'CSRM_E2E_RUNTIME_ATTESTATION_PATH', 'CSRM_E2E_RUNTIME_NONCE'] as const;
const runtimeDirectories: string[] = [];
let server: Server | undefined;

/** Puts this process inside an attested E2E runtime: the D-11 production gates minus CSRM_DEV_IDENTITY. */
function attestRuntime(environment = 'development'): void {
  const parent = join(tmpdir(), 'csrm-playwright-e2e');
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, 'transport-'));
  runtimeDirectories.push(root);
  const path = join(root, 'attestation.json');
  writeFileSync(path, JSON.stringify({ nonce: 'transport-nonce', createdAt: new Date().toISOString() }));
  vi.stubEnv('CSRM_ENVIRONMENT', environment);
  vi.stubEnv('CSRM_E2E_RUNTIME_ROOT', root);
  vi.stubEnv('CSRM_E2E_RUNTIME_ATTESTATION_PATH', path);
  vi.stubEnv('CSRM_E2E_RUNTIME_NONCE', 'transport-nonce');
}

function leaveAttestedRuntime(): void {
  vi.stubEnv('CSRM_ENVIRONMENT', undefined);
  for (const variable of runtimeVariables) vi.stubEnv(variable, undefined);
}

async function startServer(): Promise<{ baseUrl: string; requestedPaths: string[] }> {
  const requestedPaths: string[] = [];
  server = createServer((request, response) => {
    requestedPaths.push(request.url ?? '');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ data: [] }));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('The loopback test server did not expose a TCP address.');
  }

  return { baseUrl: `http://127.0.0.1:${address.port}`, requestedPaths };
}

beforeEach(() => {
  delete process.env.CSRM_API_BASE_URL;
  delete process.env.CSRM_API_TOKEN;
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (server) {
    server.close();
    await once(server, 'close');
    server = undefined;
  }

  if (originalBaseUrl === undefined) {
    delete process.env.CSRM_API_BASE_URL;
  } else {
    process.env.CSRM_API_BASE_URL = originalBaseUrl;
  }

  vi.unstubAllEnvs();
  for (const directory of runtimeDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
  if (originalDevelopmentIdentity === undefined) {
    delete process.env.CSRM_DEV_IDENTITY;
  } else {
    process.env.CSRM_DEV_IDENTITY = originalDevelopmentIdentity;
  }
  if (originalApiToken === undefined) {
    delete process.env.CSRM_API_TOKEN;
  } else {
    process.env.CSRM_API_TOKEN = originalApiToken;
  }
  vi.stubEnv('NODE_ENV', originalNodeEnvironment);
});

describe('createStrapiClient', () => {
  it('derives the development identity header from the trusted server session', async () => {
    const createClientMock = vi.fn((_options?: unknown) => ({ marker: 'typed-client' }));
    const currentSessionMock = vi.fn();

    vi.resetModules();
    vi.doMock('openapi-fetch', () => ({ default: createClientMock }));
    vi.doMock('@/lib/auth/development-session-adapter', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@/lib/auth/development-session-adapter')>()),
      getSessionAdapter: () => ({ current: currentSessionMock }),
    }));

    process.env.CSRM_API_BASE_URL = 'https://strapi.example.test/api';
    const { createStrapiClient: createIsolatedStrapiClient } = await import('./server-client');

    const createFor = async ({
      nodeEnvironment = 'development',
      identityFlag = 'true',
      developmentRole = 'Requestor',
      apiToken = 'configured-development-credential',
      attested = false,
      environment = 'development',
    }: {
      nodeEnvironment?: string;
      identityFlag?: string | null;
      developmentRole?: string | null;
      apiToken?: string | null;
      attested?: boolean;
      environment?: string;
    }) => {
      vi.stubEnv('NODE_ENV', nodeEnvironment);
      if (attested) attestRuntime(environment);
      else leaveAttestedRuntime();
      if (identityFlag === null) {
        delete process.env.CSRM_DEV_IDENTITY;
      } else {
        process.env.CSRM_DEV_IDENTITY = identityFlag;
      }
      currentSessionMock.mockResolvedValue(
        developmentRole === null
          ? null
          : { displayName: 'Development user', developmentRole },
      );
      if (apiToken === null) delete process.env.CSRM_API_TOKEN;
      else process.env.CSRM_API_TOKEN = apiToken;
      createClientMock.mockClear();

      await createIsolatedStrapiClient();

      const options = createClientMock.mock.calls[0]?.[0] as
        | { baseUrl?: string; headers?: Record<string, string> }
        | undefined;
      if (!options || options.baseUrl !== 'https://strapi.example.test/api') {
        throw new Error('BASELINE_02_03_01_STRAPI_CLIENT_CREATION_FAILED');
      }
      return options.headers;
    };

    const requestorHeaders = await createFor({ developmentRole: 'Requestor' });
    try {
      expect(requestorHeaders).toEqual({
        authorization: 'Bearer configured-development-credential',
        'x-csrm-dev-identity': 'jane.doe@idambox.com',
      });
    } catch {
      throw new Error('PHASE2_RED_02_03_01_DEV_IDENTITY_HEADER_ABSENT');
    }

    expect(await createFor({ developmentRole: 'Security Analyst' })).toEqual({
      authorization: 'Bearer configured-development-credential',
      'x-csrm-dev-identity': 'bob.doe@idambox.com',
    });
    expect(await createFor({ identityFlag: null, apiToken: null })).toBeUndefined();
    expect(await createFor({ identityFlag: 'false', apiToken: null })).toBeUndefined();
    expect(await createFor({ nodeEnvironment: 'production', apiToken: null })).toBeUndefined();
    // A production build inside the attested E2E runtime bridges exactly as next dev does.
    expect(await createFor({ nodeEnvironment: 'production', attested: true })).toEqual({
      authorization: 'Bearer configured-development-credential',
      'x-csrm-dev-identity': 'jane.doe@idambox.com',
    });
    // Each production gate alone fails closed: no identity and no token requirement.
    expect(await createFor({ nodeEnvironment: 'production', attested: true, identityFlag: 'false', apiToken: null })).toBeUndefined();
    expect(await createFor({ nodeEnvironment: 'production', attested: true, environment: 'production', apiToken: null })).toBeUndefined();
    expect(await createFor({ nodeEnvironment: 'production', identityFlag: 'true', apiToken: null })).toBeUndefined();
    expect(await createFor({ developmentRole: null })).toEqual({ authorization: 'Bearer configured-development-credential' });
    expect(await createFor({ developmentRole: 'Administrator' })).toEqual({ authorization: 'Bearer configured-development-credential' });
  });

  it('requires the API token only when the development identity bridge is enabled', async () => {
    process.env.CSRM_API_BASE_URL = 'https://strapi.example.test/api';
    vi.stubEnv('NODE_ENV', 'development');
    process.env.CSRM_DEV_IDENTITY = 'true';

    for (const token of [undefined, '']) {
      if (token === undefined) delete process.env.CSRM_API_TOKEN;
      else process.env.CSRM_API_TOKEN = token;
      await expect(createStrapiClient()).rejects.toThrow('CSRM API configuration is invalid.');
    }

    vi.stubEnv('NODE_ENV', 'production');
    await expect(createStrapiClient()).resolves.toBeDefined();

    // The attested production build enables the bridge, so the token is required there too.
    attestRuntime();
    await expect(createStrapiClient()).rejects.toThrow('CSRM API configuration is invalid.');
  });

  it('sends the generated applications path to the canonical Strapi REST endpoint', async () => {
    const { baseUrl, requestedPaths } = await startServer();
    process.env.CSRM_API_BASE_URL = `${baseUrl}/api/`;

    await (await createStrapiClient()).GET('/applications');

    expect(requestedPaths).toEqual(['/api/applications']);
  });

  it('preserves a reverse-proxy prefix that ends in the Strapi REST segment', async () => {
    const { baseUrl, requestedPaths } = await startServer();
    process.env.CSRM_API_BASE_URL = `${baseUrl}/csrm/api/`;

    await (await createStrapiClient()).GET('/applications');

    expect(requestedPaths).toEqual(['/csrm/api/applications']);
  });

  it('rejects an origin-only base before any request is made', async () => {
    process.env.CSRM_API_BASE_URL = 'http://localhost:1337';

    await expect(createStrapiClient()).rejects.toThrow('CSRM API configuration is invalid.');
  });

  it.each([
    ['a non-api terminal path', 'https://strapi.example.test/csrm'],
    ['credentials', 'https://operator:secret@strapi.example.test/api'],
    ['a query string', 'https://strapi.example.test/api?token=secret'],
    ['a fragment', 'https://strapi.example.test/api#secret'],
    ['a non-http protocol', 'ftp://strapi.example.test/api'],
    ['missing configuration', undefined],
    ['a malformed URL', 'not a URL'],
  ])('rejects %s without exposing the configured value', async (_scenario, baseUrl) => {
    process.env.CSRM_API_BASE_URL = baseUrl;

    await expect(createStrapiClient()).rejects.toThrow('CSRM API configuration is invalid.');
    await expect(createStrapiClient()).rejects.not.toThrow(String(baseUrl));
  });
});

describe('normalizeTransportError', () => {
  const genericMessage = 'The CSRM service is unavailable. Please try again later.';
  const conflictBody = (details: unknown) => ({
    data: null,
    error: { status: 409, name: 'ConflictError', message: 'CSRM assessment request cannot be reverted to draft.', details },
  });

  it('keeps a served conflict reason from the closed list and nothing else from the body', () => {
    const result = normalizeTransportError(conflictBody({ reason: 'REQUEST_WORK_STARTED', extra: 'internal' }), 409);

    expect(result).toEqual({ data: null, error: { message: genericMessage, status: 409, reason: 'REQUEST_WORK_STARTED' } });
  });
  it('keeps the locked assessment reason', () => {
    expect(normalizeTransportError(conflictBody({ reason: 'ASSESSMENT_NOT_MUTABLE' }), 409)).toEqual({
      data: null, error: { message: genericMessage, status: 409, reason: 'ASSESSMENT_NOT_MUTABLE' },
    });
  });

  it.each([
    ['a reason outside the list', { reason: 'QUESTIONNAIRE_EXISTS' }],
    ['a reason in the wrong case', { reason: 'request_work_started' }],
    ['a non-string reason', { reason: 409 }],
    ['an array of reasons', { reason: ['REQUEST_WORK_STARTED'] }],
    ['empty details', {}],
    ['details that are not an object', 'REQUEST_WORK_STARTED'],
  ])('drops %s', (_scenario, details) => {
    expect(normalizeTransportError(conflictBody(details), 409)).toEqual({ data: null, error: { message: genericMessage, status: 409 } });
  });

  it.each([
    ['a missing body', undefined],
    ['a null body', null],
    ['a body without an error', { data: null }],
    ['a thrown error', new Error('REQUEST_WORK_STARTED')],
  ])('yields no reason for %s', (_scenario, body) => {
    expect(normalizeTransportError(body, 409)).toEqual({ data: null, error: { message: genericMessage, status: 409 } });
  });

  /*
   * Phase 13 (2026-10-01 confirmation; research A4): an identity-relative refusal stays a 403 and names its rule
   * (OWN_REQUEST), so the transport keeps a closed-list reason on a 403 as on a 409 (Phase 14 widens it to any 4xx, below).
   */
  it('keeps a closed-list reason on a 403 identity refusal', () => {
    const forbiddenBody = (details: unknown) => ({
      data: null,
      error: { status: 403, name: 'ForbiddenError', message: 'CSRM request assignment is denied.', details },
    });
    expect(normalizeTransportError(forbiddenBody({ reason: 'OWN_REQUEST' }), 403)).toEqual({
      data: null, error: { message: genericMessage, status: 403, reason: 'OWN_REQUEST' },
    });
    expect(normalizeTransportError(forbiddenBody({ reason: 'NOT_A_REASON' }), 403)).toEqual({ data: null, error: { message: genericMessage, status: 403 } });
    expect(normalizeTransportError(forbiddenBody({ reason: 'OWN_REQUEST' }), 500)).toEqual({ data: null, error: { message: genericMessage, status: 500 } });
  });

  /*
   * Phase 14 (D-11; 14-RESEARCH Settled 8): the attachment refusals use 400, 413, 415 and 422 as well, so a validated
   * reason crosses on 400, 403, 409, 413, 415 and 422. A 5xx, a missing status and a thrown error still carry none,
   * except the stage B amendment's retryable 503 ATTACHMENT_BUSY (WR-204), which reaches its copy (below).
   */
  it('keeps a closed-list reason on the refusal statuses and on no other status', () => {
    for (const [status, reason] of [[400, 'ATTACHMENT_EMPTY'], [403, 'NOT_UPLOADER'], [409, 'ATTACHMENTS_CLOSED'], [413, 'ATTACHMENT_TOO_LARGE'], [415, 'ATTACHMENT_MACRO_ENABLED'], [415, 'ATTACHMENT_UNSUPPORTED_STRUCTURE'], [415, 'ATTACHMENT_ACTIVE_CONTENT'], [422, 'ATTACHMENT_MALWARE_FOUND']] as const) {
      expect(normalizeTransportError(conflictBody({ reason }), status)).toEqual({ data: null, error: { message: genericMessage, status, reason } });
    }
    expect(normalizeTransportError(conflictBody({ reason: 'ATTACHMENT_EMPTY' }), 500)).toEqual({ data: null, error: { message: genericMessage, status: 500 } });
    expect(normalizeTransportError(conflictBody({ reason: 'ATTACHMENT_EMPTY' }), 503)).toEqual({ data: null, error: { message: genericMessage, status: 503 } });
    expect(normalizeTransportError(conflictBody({ reason: 'REQUEST_WORK_STARTED' }))).toEqual({ data: null, error: { message: genericMessage } });
    expect(normalizeTransportError(conflictBody({ reason: 'NOT_A_REASON' }), 415)).toEqual({ data: null, error: { message: genericMessage, status: 415 } });
  });

  /*
   * Phase 15 (D-18; I-2, a regression guard that passed before the phase's web work): an instruction refusal is a 400
   * whose closed reason crosses so the instruction field can name it, while a 400 naming anything outside the list, and
   * the served message, stay behind.
   */
  it('keeps a 400’s instruction reason and drops a 400 reason outside the closed list', () => {
    const badRequestBody = (details: unknown) => ({
      data: null,
      error: { status: 400, name: 'BadRequestError', message: 'CSRM analyst instruction is not allowed.', details },
    });
    expect(normalizeTransportError(badRequestBody({ reason: 'INSTRUCTION_TOO_LONG' }), 400)).toEqual({
      data: null, error: { message: genericMessage, status: 400, reason: 'INSTRUCTION_TOO_LONG' },
    });
    expect(normalizeTransportError(badRequestBody({ reason: 'INSTRUCTION_SOUNDS_RUDE' }), 400)).toEqual({ data: null, error: { message: genericMessage, status: 400 } });
  });

  /*
   * IN-601 (D-18): a 404 is the refusal a missing record gets, so it never names a rule. The copy functions branch on a
   * listed reason before the status, so a reason kept on a 404 would turn "no longer available" into a sentence that
   * confirms the record exists. Any reason on a 404 is dropped.
   */
  it('drops any reason on a 404, so the existence-hiding refusal names no rule', () => {
    const forbiddenBody = (details: unknown) => ({
      data: null,
      error: { status: 403, name: 'ForbiddenError', message: 'CSRM request assignment is denied.', details },
    });
    expect(normalizeTransportError(forbiddenBody({ reason: 'OWN_REQUEST' }), 404)).toEqual({ data: null, error: { message: genericMessage, status: 404 } });
    for (const reason of ['ATTACHMENT_REMOVED', 'ATTACHMENT_BLOCKED', 'NOT_UPLOADER', 'REQUEST_WORK_STARTED']) {
      expect(normalizeTransportError(conflictBody({ reason }), 404)).toEqual({ data: null, error: { message: genericMessage, status: 404 } });
    }
    expect(normalizeTransportError({ error: { status: 404, name: 'NotFoundError', message: 'x', details: { reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Win.Test.EICAR_HDB-1' } } }, 404))
      .toEqual({ data: null, error: { message: genericMessage, status: 404 } });
  });

  /*
   * The stage B amendment (2026-10-11, WR-204): a full screening or extraction queue is a retryable 503 naming
   * ATTACHMENT_BUSY, which crosses so the person reads the busy sentence. Any other 503 stays the generic retryable 5xx.
   */
  it('keeps ATTACHMENT_BUSY on a 503 and no other reason there', () => {
    expect(normalizeTransportError(conflictBody({ reason: 'ATTACHMENT_BUSY' }), 503)).toEqual({ data: null, error: { message: genericMessage, status: 503, reason: 'ATTACHMENT_BUSY' } });
    for (const reason of ['ATTACHMENT_EMPTY', 'ATTACHMENTS_CLOSED', 'NOT_A_REASON']) {
      expect(normalizeTransportError(conflictBody({ reason }), 503)).toEqual({ data: null, error: { message: genericMessage, status: 503 } });
    }
    for (const status of [500, 502, 504]) {
      expect(normalizeTransportError(conflictBody({ reason: 'ATTACHMENT_BUSY' }), status)).toEqual({ data: null, error: { message: genericMessage, status } });
    }
  });

  /*
   * Orchestrator Confirmations: a file that carries malware is refused with a 422 naming ATTACHMENT_MALWARE_FOUND and a
   * bounded detection name, and both reach the person's sentence. The detection crosses only beside that reason and only
   * when it matches the specification's pattern (T-14-17).
   */
  describe('a malware refusal', () => {
    const malwareBody = (details: unknown) => ({
      error: { status: 422, name: 'UnprocessableEntityError', message: 'x', details },
    });

    it('keeps the 422 reason and its detection name', () => {
      expect(normalizeTransportError(malwareBody({ reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Csrm.Test.Signature' }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Csrm.Test.Signature' },
      });
    });

    /* WR-501: real ClamAV names carry underscores; this is a detection name, not the antivirus test string. */
    it('keeps a real ClamAV name with an underscore beside ATTACHMENT_MALWARE_FOUND', () => {
      expect(normalizeTransportError(malwareBody({ reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Win.Test.EICAR_HDB-1' }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Win.Test.EICAR_HDB-1' },
      });
    });

    it('keeps a detection of 128 characters in the published alphabet', () => {
      const detection = `A${'b'.repeat(119)}.c:d/e-f`;
      expect(detection).toHaveLength(128);
      expect(normalizeTransportError(malwareBody({ reason: 'ATTACHMENT_MALWARE_FOUND', detection }), 422).error?.detection).toBe(detection);
    });

    it.each([
      ['a detection with a space', 'Csrm Test Signature'],
      ['a detection of 129 characters', `A${'b'.repeat(128)}`],
      ['a detection starting with punctuation', '.Csrm.Test'],
      ['an empty detection', ''],
      ['markup', '<b>Csrm</b>'],
      ['a non-string detection', 42],
      ['an array detection', ['Csrm.Test.Signature']],
    ])('drops %s and keeps the reason', (_scenario, detection) => {
      expect(normalizeTransportError(malwareBody({ reason: 'ATTACHMENT_MALWARE_FOUND', detection }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'ATTACHMENT_MALWARE_FOUND' },
      });
    });

    it('drops a detection beside another reason', () => {
      expect(normalizeTransportError(malwareBody({ reason: 'ATTACHMENT_TYPE_NOT_ALLOWED', detection: 'Csrm.Test.Signature' }), 415)).toEqual({
        data: null,
        error: { message: genericMessage, status: 415, reason: 'ATTACHMENT_TYPE_NOT_ALLOWED' },
      });
    });

    it('drops an unknown reason and the detection with it', () => {
      expect(normalizeTransportError(malwareBody({ reason: 'MALWARE', detection: 'Csrm.Test.Signature' }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422 },
      });
    });

    it('drops the detection on a status that carries no reason', () => {
      expect(normalizeTransportError(malwareBody({ reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Csrm.Test.Signature' }), 502)).toEqual({
        data: null,
        error: { message: genericMessage, status: 502 },
      });
    });
  });

  /*
   * Phase 19 (D-16, D-17; T-19-03): an export over the row cap is refused 422 EXPORT_ROW_LIMIT with the rows it would
   * hold and the cap. Both cross only beside that reason, and only as non-negative safe integers, so the dialog can say
   * the count; any other value, or the same fields beside another reason, stays behind.
   */
  describe('an export row limit refusal', () => {
    const rowLimitBody = (details: unknown) => ({
      error: { status: 422, name: 'UnprocessableEntityError', message: 'x', details },
    });

    it('keeps the 422 reason with its row count and cap', () => {
      expect(normalizeTransportError(rowLimitBody({ reason: 'EXPORT_ROW_LIMIT', rowCount: 12500, rowCap: 10000 }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'EXPORT_ROW_LIMIT', rowCount: 12500, rowCap: 10000 },
      });
    });

    it.each([
      ['a negative row count', -1],
      ['a fractional row count', 12500.5],
      ['a string row count', '12500'],
      ['an unsafe row count', Number.MAX_SAFE_INTEGER + 1],
      ['a non-finite row count', Number.POSITIVE_INFINITY],
      ['a null row count', null],
    ])('drops %s and keeps the reason and the cap', (_scenario, rowCount) => {
      expect(normalizeTransportError(rowLimitBody({ reason: 'EXPORT_ROW_LIMIT', rowCount, rowCap: 10000 }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'EXPORT_ROW_LIMIT', rowCap: 10000 },
      });
    });

    it('drops a cap that is not a non-negative integer', () => {
      expect(normalizeTransportError(rowLimitBody({ reason: 'EXPORT_ROW_LIMIT', rowCount: 12500, rowCap: '10000' }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'EXPORT_ROW_LIMIT', rowCount: 12500 },
      });
    });

    it('drops the row count and cap beside another reason', () => {
      expect(normalizeTransportError(conflictBody({ reason: 'ASSESSMENT_NOT_MUTABLE', rowCount: 12500, rowCap: 10000 }), 409)).toEqual({
        data: null,
        error: { message: genericMessage, status: 409, reason: 'ASSESSMENT_NOT_MUTABLE' },
      });
    });

    it('drops a found object beside the row limit', () => {
      expect(normalizeTransportError(rowLimitBody({ reason: 'EXPORT_ROW_LIMIT', rowCount: 12500, rowCap: 10000, found: { rows: 12500 } }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'EXPORT_ROW_LIMIT', rowCount: 12500, rowCap: 10000 },
      });
    });

    it('drops the row count and cap on a status that carries no reason', () => {
      expect(normalizeTransportError(rowLimitBody({ reason: 'EXPORT_ROW_LIMIT', rowCount: 12500, rowCap: 10000 }), 500)).toEqual({
        data: null,
        error: { message: genericMessage, status: 500 },
      });
    });
  });

  /*
   * The exports record's code review amendment (2026-10-17, 3b5c66fa): an xlsx export with a text cell over Excel's
   * limit is refused 422 EXPORT_CELL_TOO_LONG with the column's closed vocabulary key and the cell limit. Both cross only
   * beside that reason: the key only when it matches the contract's pattern, the limit only as a non-negative safe integer.
   */
  describe('an export cell too long refusal', () => {
    const cellBody = (details: unknown) => ({
      error: { status: 422, name: 'UnprocessableEntityError', message: 'x', details },
    });

    it('keeps the 422 reason with its column key and cell limit', () => {
      expect(normalizeTransportError(cellBody({ reason: 'EXPORT_CELL_TOO_LONG', column: 'riskStatement', cellLimit: 32767 }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'EXPORT_CELL_TOO_LONG', column: 'riskStatement', cellLimit: 32767 },
      });
    });

    it.each([
      ['a key outside the pattern', 'risk-statement'],
      ['a key that starts with a digit', '1riskStatement'],
      ['an over-long key', `r${'a'.repeat(64)}`],
      ['a key holding a value', 'Customer records were exposed'],
      ['a key that is not a string', 7],
    ])('drops %s and keeps the reason and the limit', (_scenario, column) => {
      expect(normalizeTransportError(cellBody({ reason: 'EXPORT_CELL_TOO_LONG', column, cellLimit: 32767 }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'EXPORT_CELL_TOO_LONG', cellLimit: 32767 },
      });
    });

    it('drops a cell limit that is not a non-negative integer', () => {
      expect(normalizeTransportError(cellBody({ reason: 'EXPORT_CELL_TOO_LONG', column: 'summary', cellLimit: '32767' }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'EXPORT_CELL_TOO_LONG', column: 'summary' },
      });
    });

    it('drops the column and limit beside another reason, and the row count beside this one', () => {
      expect(normalizeTransportError(cellBody({ reason: 'EXPORT_ROW_LIMIT', rowCount: 12500, rowCap: 10000, column: 'summary', cellLimit: 32767 }), 422).error)
        .toEqual({ message: genericMessage, status: 422, reason: 'EXPORT_ROW_LIMIT', rowCount: 12500, rowCap: 10000 });
      expect(normalizeTransportError(cellBody({ reason: 'EXPORT_CELL_TOO_LONG', column: 'summary', cellLimit: 32767, rowCount: 3, rowCap: 10000 }), 422).error)
        .toEqual({ message: genericMessage, status: 422, reason: 'EXPORT_CELL_TOO_LONG', column: 'summary', cellLimit: 32767 });
    });
  });

  /*
   * Phase 19 (D-25 to D-27; T-19-03, T-19-04): a file refusal names what it found, so the fix-it copy can say it. The
   * found object crosses only beside an IMPORT_ reason and only when it is closed and bounded as the contract publishes
   * it; its strings lose C0 and C1 controls and bidirectional overrides, so they are safe to show as text.
   */
  describe('an import file refusal', () => {
    const fileBody = (details: unknown, status = 422) => ({
      error: { status, name: 'UnprocessableEntityError', message: 'x', details },
    });

    it('keeps the delimiter it found beside IMPORT_DELIMITER', () => {
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_DELIMITER', found: { delimiter: 'semicolon' } }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'IMPORT_DELIMITER', found: { delimiter: 'semicolon' } },
      });
    });

    it('keeps every published key within its bounds', () => {
      const found = { headers: ['Name', 'NAME'], labels: ['Name'], delimiter: 'tab', rows: 5001, bytes: 0 };
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_DUPLICATE_HEADER', found }), 422).error?.found).toEqual(found);
    });

    it('keeps 20 headers of 200 characters', () => {
      const headers = Array.from({ length: 20 }, (_, index) => `${String(index).padStart(2, '0')}${'h'.repeat(198)}`);
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_DUPLICATE_HEADER', found: { headers } }), 422).error?.found).toEqual({ headers });
    });

    it('keeps the bytes beside a 413 IMPORT_FILE_TOO_LARGE', () => {
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_FILE_TOO_LARGE', found: { bytes: 6_000_000 } }, 413), 413).error).toEqual({
        message: genericMessage, status: 413, reason: 'IMPORT_FILE_TOO_LARGE', found: { bytes: 6_000_000 },
      });
    });

    it('strips a right-to-left override, other bidirectional controls and C0 and C1 controls from a header', () => {
      const found = { headers: ['Na‮me', '⁦Owner⁩\u0000\u0085'], labels: ['Name\u001B'] };
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_DUPLICATE_HEADER', found }), 422).error?.found).toEqual({
        headers: ['Name', 'Owner'],
        labels: ['Name'],
      });
    });

    /*
     * FE4-10: the strings lose what the attachment name rule removes (file-response.ts IN-403): every control, every
     * format character (the zero-width and joining characters, the soft hyphen, the byte order mark and the tags too)
     * and the line and paragraph separators. The rule is written with escapes, so no invisible character sits in source.
     */
    it('strips zero-width, soft-hyphen, byte-order-mark, tag and separator characters too', () => {
      const found = { headers: ['​Na­me﻿', 'Own er ', 'Owner/Team\u{E0041}‍'], labels: ['⁠Name‌'] };
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_DUPLICATE_HEADER', found }), 422).error?.found).toEqual({
        headers: ['Name', 'Owner', 'Owner/Team'],
        labels: ['Name'],
      });
    });

    it('writes its character rule with escapes only', () => {
      const source = readFileSync(join(process.cwd(), 'src/lib/api/transport/server-client.ts'), 'utf8');
      const invisible = [...source].filter((character) => /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(character) && !['\n', '\r', '\t'].includes(character));
      expect(invisible.map((character) => `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)).toEqual([]);
    });

    it('drops found beside EXPORT_ROW_LIMIT', () => {
      expect(normalizeTransportError(fileBody({ reason: 'EXPORT_ROW_LIMIT', rowCount: 12500, rowCap: 10000, found: { delimiter: 'semicolon' } }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'EXPORT_ROW_LIMIT', rowCount: 12500, rowCap: 10000 },
      });
    });

    it('drops found beside a reason outside the import refusals', () => {
      expect(normalizeTransportError(fileBody({ reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Csrm.Test.Signature', found: { rows: 1 } }), 422).error).toEqual({
        message: genericMessage, status: 422, reason: 'ATTACHMENT_MALWARE_FOUND', detection: 'Csrm.Test.Signature',
      });
    });

    it('drops the row count and cap beside an import refusal', () => {
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_TOO_MANY_ROWS', rowCount: 5001, rowCap: 5000, found: { rows: 5001 } }), 422).error).toEqual({
        message: genericMessage, status: 422, reason: 'IMPORT_TOO_MANY_ROWS', found: { rows: 5001 },
      });
    });

    it.each([
      ['an unknown key', { delimiter: 'tab', cells: ['secret'] }],
      ['21 headers', { headers: Array.from({ length: 21 }, (_, index) => `H${index}`) }],
      ['a 201-character header', { headers: ['h'.repeat(201)] }],
      ['21 labels', { labels: Array.from({ length: 21 }, (_, index) => `L${index}`) }],
      ['a 201-character label', { labels: ['l'.repeat(201)] }],
      ['a header that is not a string', { headers: [42] }],
      ['headers that are not an array', { headers: 'Name' }],
      ['an unknown delimiter', { delimiter: 'pipe' }],
      ['a negative row count', { rows: -1 }],
      ['a fractional byte count', { bytes: 1.5 }],
      ['a string row count', { rows: '5001' }],
      ['an array', [{ delimiter: 'tab' }]],
      ['a string', 'semicolon'],
      ['null', null],
    ])('drops a found with %s and keeps the reason', (_scenario, found) => {
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_DELIMITER', found }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'IMPORT_DELIMITER' },
      });
    });

    /* The import record's 2026-10-17 amendment: a CSV the parser cannot read names the line it failed on, beside its reason only. */
    it('keeps the line beside IMPORT_CSV_MALFORMED', () => {
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_CSV_MALFORMED', found: { line: 7 } }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'IMPORT_CSV_MALFORMED', found: { line: 7 } },
      });
    });

    it('keeps IMPORT_CSV_MALFORMED without a found when the parser named no line', () => {
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_CSV_MALFORMED' }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'IMPORT_CSV_MALFORMED' },
      });
    });

    it('drops the line beside any other import refusal', () => {
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_DELIMITER', found: { delimiter: 'tab', line: 3 } }), 422).error).toEqual({
        message: genericMessage, status: 422, reason: 'IMPORT_DELIMITER', found: { delimiter: 'tab' },
      });
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_TOO_MANY_ROWS', found: { line: 3 } }), 422).error).toEqual({
        message: genericMessage, status: 422, reason: 'IMPORT_TOO_MANY_ROWS',
      });
    });

    it.each([
      ['a zero line', { line: 0 }],
      ['a negative line', { line: -2 }],
      ['a fractional line', { line: 1.5 }],
      ['a string line', { line: '7' }],
      ['a line beside an unknown key', { line: 7, text: 'Name,"broken' }],
    ])('drops a found with %s beside IMPORT_CSV_MALFORMED and keeps the reason', (_scenario, found) => {
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_CSV_MALFORMED', found }), 422)).toEqual({
        data: null,
        error: { message: genericMessage, status: 422, reason: 'IMPORT_CSV_MALFORMED' },
      });
    });

    it('drops found on a status that carries no reason', () => {
      expect(normalizeTransportError(fileBody({ reason: 'IMPORT_DELIMITER', found: { delimiter: 'tab' } }, 500), 500)).toEqual({
        data: null,
        error: { message: genericMessage, status: 500 },
      });
    });
  });
});
