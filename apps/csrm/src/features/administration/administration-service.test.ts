import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
const normalizeTransportError = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: vi.fn(async () => ({ POST: post })),
  normalizeTransportError,
}));
vi.mock('next/cache', () => ({ revalidatePath }));

afterEach(() => {
  post.mockReset();
  normalizeTransportError.mockReset();
  revalidatePath.mockReset();
});

type JsonSchema = {
  additionalProperties?: boolean;
  enum?: string[];
  maxItems?: number;
  properties?: Record<string, JsonSchema>;
  required?: string[];
};

type OpenApiOperation = {
  operationId?: string;
  requestBody?: {
    content?: Record<string, { schema?: { $ref?: string } }>;
  };
  responses?: Record<string, unknown>;
};

type OpenApiDocument = {
  components: { schemas: Record<string, JsonSchema> };
  paths: Record<string, Record<string, OpenApiOperation>>;
};

const specificationPath = resolve(process.cwd(), '../../docs/references/specification.json');
const generatedSchemaPath = resolve(process.cwd(), 'src/lib/api/generated/schema.d.ts');
const authoritativeCataloguePath = resolve(
  process.cwd(),
  '../../docs/references/idambox-csrm-role-function-api-catalogue.json',
);
const bootstrapCataloguePath = resolve(
  process.cwd(),
  '../backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json',
);
const contractGapPath = resolve(
  process.cwd(),
  '../../docs/contract-gaps/phase-06-administration-import-contract.md',
);

const specification = JSON.parse(readFileSync(specificationPath, 'utf8')) as OpenApiDocument;
const generatedSchema = readFileSync(generatedSchemaPath, 'utf8');

const collections = [
  ['risk-types', 'risk_types', 'riskTypeId', 'assessment-workflow/get-risk-types'],
  ['controls', 'controls', 'controlId', 'assessment-workflow/get-controls'],
  ['information-systems', 'information_systems', 'informationSystemId', 'administration/list-information-systems'],
  ['information-assets', 'information_assets', 'informationAssetId', 'administration/list-information-assets'],
] as const;

const expectedOperations = collections.flatMap(([kind, path, id, listOperationId]) => [
  [`/v1/${path}`, 'get', listOperationId],
  [`/v1/${path}`, 'post', `administration/create-${kind}`],
  [`/v1/${path}/{${id}}`, 'get', `administration/get-${kind}`],
  [`/v1/${path}/{${id}}`, 'patch', `administration/update-${kind}`],
  [`/v1/${path}/import/preview`, 'post', `administration/preview-${kind}-import`],
  [`/v1/${path}/import`, 'post', `administration/commit-${kind}-import`],
] as const);

const fiveStates = ['create', 'update', 'unchanged', 'rejected', 'ambiguous'];

async function fileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolveBytes, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolveBytes(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(file);
  });
}

describe('Phase 6 Administration OpenAPI contract', () => {
  it('validates import Server Action FormData and revalidates only confirmed success', async () => {
    const actions = await import('./administration-actions');
    const bytes = new TextEncoder().encode('name\r\nCredential misuse');
    const file = new File([bytes], 'risk-types.csv', { type: 'text/csv' });
    const digest = `sha256:${'a'.repeat(64)}`;
    const invalid = new FormData();
    invalid.set('kind', 'unknown-collection');
    invalid.set('file', file);
    await expect(actions.previewAdministrationCsvAction(invalid)).resolves.toEqual({
      ok: false, formError: 'This CSV import is not available.',
    });
    expect(post).not.toHaveBeenCalled();

    const previewData = {
      fileName: 'risk-types.csv', previewDigest: digest, limits: { maxBytes: 5_242_880, maxRows: 5_000 },
      summary: { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0 },
      rows: [{ rowNumber: 2, state: 'create', naturalKey: 'Credential misuse', matchedDocumentId: null, values: { name: 'Credential misuse' }, changes: [], issues: [] }],
    };
    post.mockResolvedValueOnce({ data: { data: previewData }, response: { status: 200 } });
    const previewForm = new FormData();
    previewForm.set('kind', 'risk-types'); previewForm.set('file', file);
    await expect(actions.previewAdministrationCsvAction(previewForm)).resolves.toEqual({ ok: true, data: previewData });
    expect(revalidatePath).not.toHaveBeenCalled();

    const unconfirmed = new FormData();
    unconfirmed.set('kind', 'risk-types'); unconfirmed.set('file', file); unconfirmed.set('previewDigest', digest);
    await expect(actions.commitAdministrationCsvAction(unconfirmed)).resolves.toMatchObject({ ok: false });
    expect(post).toHaveBeenCalledTimes(1);

    const resultData = {
      fileName: 'risk-types.csv', previewDigest: digest, limits: { maxBytes: 5_242_880, maxRows: 5_000 },
      summary: { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0 }, previewChanged: 0,
      rows: [{ rowNumber: 2, state: 'create', naturalKey: 'Credential misuse', documentId: 'risk-type-1', issues: [] }],
    };
    post.mockResolvedValueOnce({ data: { data: resultData }, response: { status: 200 } });
    const commitForm = new FormData();
    commitForm.set('kind', 'risk-types'); commitForm.set('file', file);
    commitForm.set('previewDigest', digest); commitForm.set('confirmed', 'true');
    await expect(actions.commitAdministrationCsvAction(commitForm)).resolves.toEqual({ ok: true, data: resultData });
    expect(revalidatePath).toHaveBeenCalledOnce();
  });

  it('sends identical File bytes through generated multipart calls without headers or retries', async () => {
    const bytes = new TextEncoder().encode('name,description\r\nCredential misuse,Reusable definition');
    const file = new File([bytes], 'risk-types.csv', { type: 'text/csv' });
    const digest = 'a'.repeat(64);
    const preview = {
      data: {
        rows: [{
          rowNumber: 2, state: 'create', naturalKey: 'Credential misuse', matchedDocumentId: null,
          values: { name: 'Credential misuse', description: 'Reusable definition' }, changes: [], issues: [],
        }],
        summary: { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0 },
        limits: { maxBytes: 5_242_880, maxRows: 5_000 }, fileName: 'risk-types.csv', previewDigest: `sha256:${digest}`,
      },
    };
    const result = {
      data: {
        rows: [{ rowNumber: 2, state: 'create', naturalKey: 'Credential misuse', documentId: 'risk-type-1', issues: [] }],
        summary: { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0 },
        fileName: 'risk-types.csv', limits: { maxBytes: 5_242_880, maxRows: 5_000 },
        previewDigest: `sha256:${digest}`, previewChanged: 0,
      },
    };
    post.mockResolvedValueOnce({ data: preview, response: { status: 200 } });
    post.mockResolvedValueOnce({ data: result, response: { status: 200 } });

    const service = await import('./administration-service');
    await expect(service.previewRiskTypesCsv(file)).resolves.toEqual({ data: preview.data, error: null });
    await expect(service.commitRiskTypesCsv(file, `sha256:${digest}`)).resolves.toEqual({ data: result.data, error: null });

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls.map(([path]) => path)).toEqual([
      '/v1/risk_types/import/preview', '/v1/risk_types/import',
    ]);
    for (const [, options] of post.mock.calls) {
      expect(options).toEqual({ body: expect.any(FormData), bodySerializer: expect.any(Function) });
      expect(options).not.toHaveProperty('headers');
      const body = options.body as FormData;
      const sentFile = body.get('file') as File;
      expect(Array.from(await fileBytes(sentFile))).toEqual(Array.from(bytes));
    }
    expect((post.mock.calls[1]?.[1]?.body as FormData).get('previewDigest')).toBe(`sha256:${digest}`);
    expect((post.mock.calls[1]?.[1]?.body as FormData).get('confirmed')).toBe('true');

    normalizeTransportError.mockReturnValue({ data: null, error: { message: 'Unknown outcome.', status: 503 } });
    post.mockRejectedValueOnce(new Error('connection lost'));
    await expect(service.commitRiskTypesCsv(file, `sha256:${digest}`)).resolves.toEqual({
      data: null, error: { message: 'Unknown outcome.', status: 503 },
    });
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('publishes the exact 24 literal CRUD and import operations without delete', () => {
    expect(expectedOperations).toHaveLength(24);

    for (const [path, method, operationId] of expectedOperations) {
      const operation = specification.paths[path]?.[method];
      expect(operation, `${method.toUpperCase()} ${path}`).toBeDefined();
      expect(operation?.operationId).toBe(operationId);
      expect(specification.paths[path]?.delete, `DELETE ${path}`).toBeUndefined();
      expect(generatedSchema).toContain(`${JSON.stringify(path)}: {`);
      expect(generatedSchema).toContain(`${JSON.stringify(operationId)}: {`);
    }

    expect(new Set(expectedOperations.map(([, , operationId]) => operationId))).toHaveLength(24);
  });

  it('keeps all five classifications distinct in preview and commit DTOs', () => {
    const schemas = specification.components.schemas;

    expect(schemas.AdministrationImportState.enum).toEqual(fiveStates);
    for (const schemaName of ['AdministrationImportSummary', 'AdministrationImportResultSummary']) {
      const schema = schemas[schemaName];
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required).toEqual(expect.arrayContaining(fiveStates));
      expect(Object.keys(schema.properties ?? {})).toEqual(expect.arrayContaining(fiveStates));
    }

    expect(schemas.AdministrationImportPreviewRow.properties?.state?.enum).toEqual(fiveStates);
    expect(schemas.AdministrationImportResultRow.properties?.state?.enum).toEqual(fiveStates);
    expect(schemas.AdministrationImportPreviewData.properties?.rows?.maxItems).toBe(5_000);
    expect(schemas.AdministrationImportResultData.properties?.rows?.maxItems).toBe(5_000);
    expect(generatedSchema).toContain(
      'AdministrationImportState: "create" | "update" | "unchanged" | "rejected" | "ambiguous";',
    );
  });

  it('binds preview and confirmed commit to bounded multipart file inputs', () => {
    const schemas = specification.components.schemas;
    expect(schemas.AdministrationImportLimits.required).toEqual(['maxBytes', 'maxRows']);
    expect(schemas.AdministrationImportPreviewRequest.required).toEqual(['file']);
    expect(schemas.AdministrationImportCommitRequest.required).toEqual([
      'file',
      'previewDigest',
      'confirmed',
    ]);

    for (const [, path] of collections) {
      const preview = specification.paths[`/v1/${path}/import/preview`]?.post;
      const commit = specification.paths[`/v1/${path}/import`]?.post;
      expect(preview?.requestBody?.content?.['multipart/form-data']?.schema?.$ref).toBe(
        '#/components/schemas/AdministrationImportPreviewRequest',
      );
      expect(commit?.requestBody?.content?.['multipart/form-data']?.schema?.$ref).toBe(
        '#/components/schemas/AdministrationImportCommitRequest',
      );
      expect(preview?.responses?.['413']).toBeDefined();
      expect(commit?.responses?.['409']).toBeDefined();
    }
  });

  it('does not expose a write result for unchanged or rejected rows', () => {
    const resultRow = specification.components.schemas.AdministrationImportResultRow;
    expect(resultRow.required).not.toContain('documentId');
    expect(resultRow.properties?.documentId).toBeDefined();
    expect(resultRow.properties?.state?.enum).toEqual(fiveStates);
  });

  it('keeps exact human-only grants byte-identical and records the resolved INT-01 boundary', () => {
    const authoritativeBytes = readFileSync(authoritativeCataloguePath);
    const bootstrapBytes = readFileSync(bootstrapCataloguePath);
    expect(bootstrapBytes.equals(authoritativeBytes)).toBe(true);

    const catalogue = JSON.parse(authoritativeBytes.toString('utf8')) as {
      functionApis: Array<{ functionId: string; url: string }>;
      functions: Array<{ id: string; roleIds: string[] }>;
    };
    const administrationFunctions = catalogue.functions.filter(({ id }) =>
      id.startsWith('function.administration.'),
    );
    const administrationApis = catalogue.functionApis.filter(({ functionId }) =>
      functionId.startsWith('function.administration.'),
    );
    expect(administrationFunctions).toHaveLength(8);
    expect(administrationFunctions.every(({ roleIds }) =>
      roleIds.length === 1 && roleIds[0] === 'role.security_analyst')).toBe(true);
    expect(administrationApis).toHaveLength(24);
    expect(new Set(administrationApis.map(({ url }) => url))).toHaveLength(24);
    expect(administrationApis.some(({ url }) => url.startsWith('DELETE:'))).toBe(false);

    const contractGap = readFileSync(contractGapPath, 'utf8');
    for (const requiredContract of [
      'RESOLVED',
      'INT-01',
      '5,242,880 bytes',
      '5,000',
      'create',
      'update',
      'unchanged',
      'rejected',
      'ambiguous',
      'previewDigest',
      'confirmed=true',
      'per-row transaction',
      'single Strapi process',
      'cross-process uniqueness is not guaranteed',
      'separately approved unique index/schema migration',
    ]) {
      expect(contractGap).toContain(requiredContract);
    }
  });
});
