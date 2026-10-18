import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
const normalizeTransportError = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const viewerTimeZone = vi.hoisted(() => vi.fn(async (): Promise<string | null> => null));

vi.mock('server-only', () => ({}));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: vi.fn(async () => ({ GET: get, POST: post })),
  normalizeTransportError,
}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('@/lib/time/viewer-time-zone', () => ({ readViewerTimeZone: viewerTimeZone }));

afterEach(() => {
  post.mockReset();
  get.mockReset();
  normalizeTransportError.mockReset();
  revalidatePath.mockReset();
});

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** A file Strapi serves: its bytes, its type and its attachment name, as the generated client returns a binary parse. */
function servedFile(fileName: string, bytes: Uint8Array, contentType: string, rowCount?: number) {
  const headers = new Headers({
    'content-type': contentType,
    'content-disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
    ...(rowCount === undefined ? {} : { 'x-csrm-row-count': String(rowCount) }),
  });
  return { data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), response: { status: 200, headers } };
}

const workbookBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);

/*
 * Phase 19 (19-15, D-31): the templates are Strapi's files. The service asks the collection's template operation for the
 * format and hands back only bytes the export rule accepts; the action words a refusal with S3.
 */
describe('CSV-02 import templates from Strapi', () => {
  it('downloads the Information Systems workbook template, checked by the export rule', async () => {
    get.mockResolvedValueOnce(servedFile('information-systems-import-template.xlsx', workbookBytes, XLSX_TYPE));
    const service = await import('./administration-service');

    const result = await service.downloadImportTemplate('information-systems', 'xlsx');
    expect(result.error).toBeNull();
    expect(result.data?.fileName).toBe('information-systems-import-template.xlsx');
    expect(result.data?.contentType).toBe(XLSX_TYPE);
    expect(Array.from(result.data?.bytes ?? [])).toEqual(Array.from(workbookBytes));
    expect(get).toHaveBeenCalledWith('/v1/information_systems/import/template', { params: { query: { format: 'xlsx' } }, parseAs: 'arrayBuffer' });
  });

  it.each([
    ['risk-types', 'csv', '/v1/risk_types/import/template'],
    ['controls', 'xlsx', '/v1/controls/import/template'],
    ['information-assets', 'csv', '/v1/information_assets/import/template'],
  ] as const)('asks %s for its %s template at %s', async (kind, format, path) => {
    const bytes = format === 'csv' ? new Uint8Array([0xef, 0xbb, 0xbf, 0x4e, 0x61, 0x6d, 0x65]) : workbookBytes;
    get.mockResolvedValueOnce(servedFile(`${kind}-import-template.${format}`, bytes, format === 'csv' ? 'text/csv; charset=utf-8' : XLSX_TYPE));
    const service = await import('./administration-service');
    await expect(service.downloadImportTemplate(kind, format)).resolves.toMatchObject({ data: { fileName: `${kind}-import-template.${format}` }, error: null });
    expect(get.mock.calls[0]?.[0]).toBe(path);
  });

  it('drops a template whose bytes are not the format it names', async () => {
    get.mockResolvedValueOnce(servedFile('risk-types-import-template.xlsx', new TextEncoder().encode('<html>'), XLSX_TYPE));
    const service = await import('./administration-service');
    await expect(service.downloadImportTemplate('risk-types', 'xlsx')).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'signature' } });
  });

  it('returns the saved file from the action, and S3’s copy for a refusal or an invalid request', async () => {
    const actions = await import('./administration-actions');
    get.mockResolvedValueOnce(servedFile('information-systems-import-template.xlsx', workbookBytes, XLSX_TYPE));
    await expect(actions.downloadImportTemplateAction({ kind: 'information-systems', format: 'xlsx' })).resolves.toMatchObject({
      ok: true, fileName: 'information-systems-import-template.xlsx', contentType: XLSX_TYPE,
    });

    normalizeTransportError.mockReturnValue({ data: null, error: { message: 'Unavailable.', status: 503 } });
    get.mockResolvedValueOnce({ data: undefined, error: {}, response: { status: 503, headers: new Headers() } });
    await expect(actions.downloadImportTemplateAction({ kind: 'risk-types', format: 'csv' })).resolves.toEqual({
      ok: false, refusal: { message: 'We couldn’t download the template.', action: 'Try again' },
    });

    get.mockClear();
    for (const input of [{ kind: 'risks', format: 'csv' }, { kind: 'risk-types', format: 'xls' }, { kind: 'risk-types', format: 'csv', extra: 1 }, null]) {
      await expect(actions.downloadImportTemplateAction(input)).resolves.toMatchObject({ ok: false });
    }
    expect(get).not.toHaveBeenCalled();
  });
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

// 19-13 (D-30): the five Phase 6 classifications and the sixth, `similar` (Matched by similar name).
const sixStates = ['create', 'update', 'unchanged', 'rejected', 'ambiguous', 'similar'];
const resultSummaryKeys = ['create', 'update', 'unchanged', 'rejected', 'ambiguous', 'skipped'];

async function fileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolveBytes, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolveBytes(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(file);
  });
}

/*
 * Phase 19 (19-15 Task 2; D-26, D-30, D-32): the actions word a refused file with S2 (from the feature-only family S
 * module, never the shared refusal copy), a refused step with S3, send the similar rows' decisions with the commit, and
 * return Strapi's error report with its row count.
 */
describe('CSV-03 import refusals, decisions and error reports in the actions', () => {
  const digest = `sha256:${'a'.repeat(64)}`;
  const resultToken = `sha256:${'c'.repeat(64)}`;
  const csv = () => new File([new TextEncoder().encode('Name\r\nCredential misuse')], 'risk-types.csv', { type: 'text/csv' });
  const refused = (status: number, error: Record<string, unknown>) => {
    normalizeTransportError.mockReturnValue({ data: null, error: { message: 'Refused.', status, ...error } });
    post.mockResolvedValueOnce({ data: undefined, error: {}, response: { status, headers: new Headers() } });
  };
  const previewForm = (file = csv()) => {
    const form = new FormData();
    form.set('kind', 'controls');
    form.set('file', file);
    return form;
  };
  const commitForm = (decisions?: string) => {
    const form = new FormData();
    form.set('kind', 'risk-types'); form.set('file', csv()); form.set('previewDigest', digest); form.set('confirmed', 'true');
    if (decisions !== undefined) form.set('decisions', decisions);
    return form;
  };

  it('words a refused file with S2, naming what Strapi found, the file and its size', async () => {
    const actions = await import('./administration-actions');
    refused(422, { reason: 'IMPORT_MISSING_COLUMN', found: { labels: ['Name', 'Framework'] } });
    await expect(actions.previewAdministrationCsvAction(previewForm())).resolves.toEqual({
      ok: false,
      formError: 'A required column is missing',
      refusal: { family: 'file', reason: 'IMPORT_MISSING_COLUMN', title: 'A required column is missing', body: 'Add columns named Name and Framework (they’re in the template), then choose the file again.', steps: [] },
    });

    refused(422, { reason: 'IMPORT_CSV_MALFORMED', found: { line: 7 } });
    await expect(actions.previewAdministrationCsvAction(previewForm())).resolves.toMatchObject({
      refusal: { family: 'file', title: 'Fix the CSV file', body: 'Line 7 can’t be read. A quote may be missing, or the row has a different number of columns from the header.' },
    });

    refused(413, { reason: 'IMPORT_FILE_TOO_LARGE' });
    await expect(actions.previewAdministrationCsvAction(previewForm())).resolves.toMatchObject({
      refusal: { family: 'file', title: 'This file is too large', body: '“risk-types.csv” is 23 bytes. The limit is 5 MB. Split the rows into smaller files and import each.' },
    });
  });

  it('keeps its own words for a malformed request (400) and a denial (403), with no file refusal', async () => {
    const actions = await import('./administration-actions');
    refused(400, {});
    const malformed = await actions.previewAdministrationCsvAction(previewForm());
    expect(malformed).toEqual({ ok: false, formError: 'We couldn’t check this file. Choose it again to retry.' });
    refused(403, {});
    await expect(actions.previewAdministrationCsvAction(previewForm())).resolves.toEqual({ ok: false, formError: 'You do not have permission to import Controls.' });
  });

  it('refuses a wrong extension or an empty file before any request, with S2', async () => {
    const actions = await import('./administration-actions');
    await expect(actions.previewAdministrationCsvAction(previewForm(new File(['x'], 'controls.xls')))).resolves.toMatchObject({
      ok: false, refusal: { family: 'file', reason: 'IMPORT_FILE_TYPE', body: '“controls.xls” isn’t a CSV or Excel workbook (.xlsx).' },
    });
    await expect(actions.previewAdministrationCsvAction(previewForm(new File([], 'controls.csv')))).resolves.toMatchObject({
      ok: false, refusal: { family: 'file', reason: 'IMPORT_NO_HEADER' },
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('sends the decisions as one JSON string with the commit, and refuses a decision outside the closed set', async () => {
    const actions = await import('./administration-actions');
    post.mockResolvedValueOnce({ data: { data: {
      fileName: 'risk-types.csv', previewDigest: digest, resultToken, limits: { maxBytes: 5_242_880, maxRows: 5_000 },
      summary: { create: 0, update: 1, unchanged: 0, rejected: 0, ambiguous: 0, skipped: 1 }, previewChanged: 0,
      rows: [
        { rowNumber: 3, state: 'similar', naturalKey: 'credential misuse', decision: 'skip', issues: [] },
        { rowNumber: 4, state: 'similar', naturalKey: 'CREDENTIAL MISUSE', decision: 'update', documentId: 'risk-type-1', issues: [] },
      ],
    } }, response: { status: 200 } });
    await expect(actions.commitAdministrationCsvAction(commitForm('{"3":"skip","4":"update"}'))).resolves.toMatchObject({ ok: true });
    const body = post.mock.calls[0]?.[1]?.body as FormData;
    expect(post.mock.calls[0]?.[0]).toBe('/v1/risk_types/import');
    expect(body.get('decisions')).toBe('{"3":"skip","4":"update"}');

    post.mockClear();
    for (const decisions of ['{"3":"replace"}', '{"row":"skip"}', '[]', 'not json', `{${Array.from({ length: 5_001 }, (_, index) => `"${index + 2}":"skip"`).join(',')}}`]) {
      await expect(actions.commitAdministrationCsvAction(commitForm(decisions))).resolves.toMatchObject({ ok: false });
    }
    expect(post).not.toHaveBeenCalled();
  });

  it('words a missed decision and an expired review with S3, and a changed file as before', async () => {
    const actions = await import('./administration-actions');
    refused(409, { reason: 'IMPORT_DECISION_MISSING' });
    await expect(actions.commitAdministrationCsvAction(commitForm())).resolves.toEqual({
      ok: false,
      formError: 'Choose Update or Skip for every row matched by similar name, then confirm again.',
      refusal: { family: 'step', step: 'decision-missing', message: 'Choose Update or Skip for every row matched by similar name, then confirm again.', action: null },
    });
    refused(409, { reason: 'IMPORT_REVIEW_EXPIRED' });
    await expect(actions.commitAdministrationCsvAction(commitForm())).resolves.toMatchObject({
      refusal: { family: 'step', step: 'review-expired', message: 'This review has expired. Choose the file again to check it.', action: 'Choose file again' },
    });
    refused(409, {});
    await expect(actions.commitAdministrationCsvAction(commitForm())).resolves.toEqual({ ok: false, formError: 'The selected file no longer matches the reviewed preview.' });
  });

  it('downloads the error report Strapi rebuilds from the file and one token, with its row count', async () => {
    const actions = await import('./administration-actions');
    viewerTimeZone.mockResolvedValueOnce('Australia/Sydney');
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x4e, 0x61, 0x6d, 0x65]);
    post.mockResolvedValueOnce(servedFile('risk-types-import-issues-2026-10-17.csv', bytes, 'text/csv; charset=utf-8', 2));
    const form = new FormData();
    form.set('kind', 'risk-types'); form.set('file', csv()); form.set('previewDigest', digest);
    await expect(actions.downloadImportErrorReportAction(form)).resolves.toEqual({
      ok: true, fileName: 'risk-types-import-issues-2026-10-17.csv', contentType: 'text/csv', bytes, rowCount: 2,
    });
    const [path, options] = post.mock.calls[0] as [string, { body: FormData; parseAs: string }];
    expect(path).toBe('/v1/risk_types/import/error_report');
    expect(options.parseAs).toBe('arrayBuffer');
    expect(options.body.get('previewDigest')).toBe(digest);
    expect(options.body.get('resultToken')).toBeNull();
    expect(options.body.get('timeZone')).toBe('Australia/Sydney');
    expect((options.body.get('file') as File).name).toBe('risk-types.csv');

    refused(409, { reason: 'IMPORT_REVIEW_EXPIRED' });
    const atResults = new FormData();
    atResults.set('kind', 'information-assets'); atResults.set('file', csv()); atResults.set('resultToken', resultToken);
    await expect(actions.downloadImportErrorReportAction(atResults)).resolves.toEqual({
      ok: false, refusal: { message: 'This review has expired. Choose the file again to check it.', action: 'Choose file again' },
    });
    expect(post.mock.calls[1]?.[0]).toBe('/v1/information_assets/import/error_report');
    refused(503, {});
    await expect(actions.downloadImportErrorReportAction(atResults)).resolves.toEqual({
      ok: false, refusal: { message: 'We couldn’t prepare the error report.', action: 'Try again' },
    });

    post.mockClear();
    const both = new FormData();
    both.set('kind', 'risk-types'); both.set('file', csv()); both.set('previewDigest', digest); both.set('resultToken', resultToken);
    const neither = new FormData();
    neither.set('kind', 'risk-types'); neither.set('file', csv());
    for (const invalid of [both, neither]) await expect(actions.downloadImportErrorReportAction(invalid)).resolves.toMatchObject({ ok: false });
    expect(post).not.toHaveBeenCalled();
  });
});

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
      summary: { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, similar: 0 },
      warnings: ['Owner'], notes: [], readOnlyColumns: [],
      rows: [{ rowNumber: 2, state: 'create', naturalKey: 'Credential misuse', matchedDocumentId: null, matchedName: null, values: { name: 'Credential misuse' }, changes: [], issues: [] }],
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
      fileName: 'risk-types.csv', previewDigest: digest, resultToken: `sha256:${'c'.repeat(64)}`, limits: { maxBytes: 5_242_880, maxRows: 5_000 },
      summary: { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, skipped: 0 }, previewChanged: 0,
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
          rowNumber: 2, state: 'create', naturalKey: 'Credential misuse', matchedDocumentId: null, matchedName: null,
          values: { name: 'Credential misuse', description: 'Reusable definition' }, changes: [], issues: [],
        }],
        summary: { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, similar: 0 },
        warnings: [], notes: [], readOnlyColumns: [],
        limits: { maxBytes: 5_242_880, maxRows: 5_000 }, fileName: 'risk-types.csv', previewDigest: `sha256:${digest}`,
      },
    };
    const result = {
      data: {
        rows: [{ rowNumber: 2, state: 'create', naturalKey: 'Credential misuse', documentId: 'risk-type-1', issues: [] }],
        summary: { create: 1, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, skipped: 0 },
        fileName: 'risk-types.csv', limits: { maxBytes: 5_242_880, maxRows: 5_000 },
        previewDigest: `sha256:${digest}`, resultToken: `sha256:${'c'.repeat(64)}`, previewChanged: 0,
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

  it('keeps all six classifications distinct in preview and commit DTOs, and the result summary counts skipped', () => {
    const schemas = specification.components.schemas;

    expect(schemas.AdministrationImportState.enum).toEqual(sixStates);
    for (const [schemaName, keys] of [['AdministrationImportSummary', sixStates], ['AdministrationImportResultSummary', resultSummaryKeys]] as const) {
      const schema = schemas[schemaName];
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required).toEqual(keys);
      expect(Object.keys(schema.properties ?? {})).toEqual(keys);
    }

    expect(schemas.AdministrationImportPreviewRow.properties?.state?.enum).toEqual(sixStates);
    expect(schemas.AdministrationImportResultRow.properties?.state?.enum).toEqual(sixStates);
    expect(schemas.AdministrationImportPreviewData.properties?.rows?.maxItems).toBe(5_000);
    expect(schemas.AdministrationImportResultData.properties?.rows?.maxItems).toBe(5_000);
    expect(generatedSchema).toContain(
      'AdministrationImportState: "create" | "update" | "unchanged" | "rejected" | "ambiguous" | "similar";',
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
    expect(resultRow.properties?.state?.enum).toEqual(sixStates);
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
    // 19-14 (D-31 to D-33): each of the four Administration Functions gained its template, error report and export.
    expect(administrationApis).toHaveLength(24 + 12);
    expect(new Set(administrationApis.map(({ url }) => url))).toHaveLength(24 + 12);
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
