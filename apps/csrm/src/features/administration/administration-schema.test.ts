import { describe, expect, it } from 'vitest';

type AdministrationSchemaModule = {
  administrationPageSizes: readonly number[];
  parseAdministrationQuery: (kind: string, input: Record<string, string | string[] | undefined>) => Record<string, unknown>;
  serializeAdministrationQuery: (input: Record<string, unknown>) => Record<string, string | number>;
  parseAdministrationListPayload: (kind: string, payload: unknown) => unknown;
  parseAdministrationDetailPayload: (kind: string, payload: unknown) => unknown;
  controlCreateInputSchema: { parse: (value: unknown) => Record<string, unknown> };
  controlAdministrationRecordSchema: { parse: (value: unknown) => Record<string, unknown> };
  riskTypeCreateInputSchema: { parse: (value: unknown) => Record<string, unknown> };
};

type CsvClientParserModule = {
  CSV_MAX_BYTES: number;
  CSV_MAX_ROWS: number;
  CSV_MAX_RECORD_BYTES: number;
  validateAdministrationCsvFile: (kind: string, file: File) => Promise<{ rowCount: number; bytes: Uint8Array }>;
  parseAdministrationCsvClient: (input: {
    kind: string;
    bytes: Uint8Array;
    existing?: readonly Record<string, unknown>[];
  }) => Promise<{ rows: Array<{ state: string; matchedDocumentId: string | null }> }>;
};

async function loadSchema(): Promise<AdministrationSchemaModule> {
  const modulePath = './administration-schema';
  return import(modulePath) as Promise<AdministrationSchemaModule>;
}

async function loadCsvParser(): Promise<CsvClientParserModule> {
  const modulePath = './csv-client-parser';
  return import(modulePath) as Promise<CsvClientParserModule>;
}

describe('ADMIN-01 ADMIN-02 ADMIN-03 Administration canonical schemas', () => {
  it('closes URL state and canonicalizes defaults, reset, page, page-size, filter, and sort', async () => {
    const schema = await loadSchema();
    expect(schema.administrationPageSizes).toEqual([10, 25, 50, 100]);
    const parsed = schema.parseAdministrationQuery('controls', {
      q: '  AC-2  ', framework: 'NIST SP 800-53', sort: 'controlNumber:desc', page: '2', pageSize: '50', forged: 'discard',
    });
    expect(parsed).toEqual({ q: 'AC-2', framework: 'NIST SP 800-53', sort: 'controlNumber:desc', page: 2, pageSize: 50 });
    expect(schema.serializeAdministrationQuery(parsed)).toEqual({
      q: 'AC-2', framework: 'NIST SP 800-53', sort: 'controlNumber:desc', page: 2, pageSize: 50,
    });
    expect(schema.parseAdministrationQuery('risk-types', { q: ' ', sort: 'unknown', page: '0', pageSize: '101' }))
      .toEqual({ q: '', sort: 'name:asc', page: 1, pageSize: 25 });
    for (const kind of ['risk-types', 'controls', 'information-systems', 'information-assets']) {
      const query = schema.parseAdministrationQuery(kind, {
        q: ['first', 'second'], sort: ['invalid', 'name:desc'], page: ['nope', '2'], pageSize: ['999', '50'], foreign: 'discard',
      });
      expect(query.q).toBe('first');
      expect(query.page).toBe(1);
      expect(query.pageSize).toBe(25);
      expect(query).not.toHaveProperty('foreign');
    }
  });

  it('normalizes blank Risk Type descriptions to null at the web trust boundary', async () => {
    const schema = await loadSchema();
    expect(schema.riskTypeCreateInputSchema.parse({ name: 'Nullable', description: '   ' })).toEqual({ name: 'Nullable', description: null });
  });

  it('accepts only closed bounded list and detail DTOs', async () => {
    const schema = await loadSchema();
    const item = { documentId: 'type-1', name: 'Credential misuse', description: null };
    const list = { data: [item], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } } };
    expect(schema.parseAdministrationListPayload('risk-types', list)).toEqual(list);
    expect(schema.parseAdministrationDetailPayload('risk-types', { data: item })).toEqual({ data: item });
    for (const hostile of [
      { ...list, debug: true },
      { ...list, data: [{ ...item, createdAt: 'hidden' }] },
      { ...list, meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: -1 } } },
      { data: Array.from({ length: 65_537 }, (_, index) => ({ ...item, documentId: `type-${index}` })), meta: { pagination: { page: 1, pageSize: 100, pageCount: 656, total: 65_537 } } },
    ]) expect(() => schema.parseAdministrationListPayload('risk-types', hostile)).toThrow();
  });

  it('accepts exact frozen Control field caps and rejects cap plus one', async () => {
    const schema = await loadSchema();
    const exact = {
      controlNumber: 'BOUNDARY-001', name: 'Boundary Control', framework: 'Boundary Framework',
      controlReference: 'r'.repeat(500), frameworkVersion: 'v'.repeat(255), frameworkSource: 's'.repeat(2_000),
    };
    expect(schema.controlCreateInputSchema.parse(exact)).toEqual(exact);
    expect(schema.controlAdministrationRecordSchema.parse({
      documentId: 'boundary-control', description: null, controlType: null, ...exact,
    })).toMatchObject(exact);

    for (const [field, value] of [
      ['controlReference', 'r'.repeat(501)],
      ['frameworkVersion', 'v'.repeat(256)],
      ['frameworkSource', 's'.repeat(2_001)],
    ] as const) {
      expect(() => schema.controlCreateInputSchema.parse({ ...exact, [field]: value })).toThrow();
      expect(() => schema.controlAdministrationRecordSchema.parse({
        documentId: 'boundary-control', description: null, controlType: null, ...exact, [field]: value,
      })).toThrow();
    }
  });
});

describe('ADMIN-04 client CSV file bounds', () => {
  it('accepts the exact 5,242,880-byte and 5,000-row limits', async () => {
    const parser = await loadCsvParser();
    expect([parser.CSV_MAX_BYTES, parser.CSV_MAX_ROWS, parser.CSV_MAX_RECORD_BYTES]).toEqual([5_242_880, 5_000, 65_536]);
    const header = 'name,description\r\n';
    const rows = Array.from({ length: 5_000 }, (_, index) => `Row ${index},${'x'.repeat(1_030)}`);
    let text = `${header}${rows.join('\r\n')}`;
    const remaining = parser.CSV_MAX_BYTES - Buffer.byteLength(text);
    expect(remaining).toBeGreaterThanOrEqual(0);
    rows[rows.length - 1] += 'x'.repeat(remaining);
    text = `${header}${rows.join('\r\n')}`;
    expect(Buffer.byteLength(text)).toBe(parser.CSV_MAX_BYTES);
    await expect(parser.validateAdministrationCsvFile('risk-types', new File([text], 'exact.csv', { type: 'text/csv' })))
      .resolves.toMatchObject({ rowCount: 5_000 });
  });

  it('rejects byte, row, and record cap plus one before preview transport', async () => {
    const parser = await loadCsvParser();
    const overRows = `name\r\n${Array.from({ length: 5_001 }, (_, index) => `Row ${index}`).join('\r\n')}`;
    const cases = [
      new File([new Uint8Array(5_242_881)], 'too-large.csv', { type: 'text/csv' }),
      new File([overRows], 'too-many-rows.csv', { type: 'text/csv' }),
      new File([`name\r\n${'x'.repeat(65_537)}`], 'record-too-large.csv', { type: 'text/csv' }),
    ];
    for (const file of cases) {
      await expect(parser.validateAdministrationCsvFile('risk-types', file)).rejects.toThrow();
    }
  });

  it('classifies against the complete existing-record set beyond the CSV row cap', async () => {
    const parser = await loadCsvParser();
    const existing = Array.from({ length: parser.CSV_MAX_ROWS + 1 }, (_, index) => ({
      documentId: `risk-type-${index}`,
      name: `Risk Type ${index}`,
      description: null,
    }));
    const bytes = new TextEncoder().encode(`name,description\r\nRisk Type ${parser.CSV_MAX_ROWS},`);

    await expect(parser.parseAdministrationCsvClient({ kind: 'risk-types', bytes, existing }))
      .resolves.toMatchObject({ rows: [{ state: 'unchanged', matchedDocumentId: `risk-type-${parser.CSV_MAX_ROWS}` }] });
  });
});
