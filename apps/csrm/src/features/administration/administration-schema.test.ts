import { describe, expect, it } from 'vitest';

type InputSchema = {
  parse: (value: unknown) => Record<string, unknown>;
  safeParse: (value: unknown) => { success: boolean; error?: { issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }> } };
};

type AdministrationSchemaModule = {
  administrationPageSizes: readonly number[];
  parseAdministrationQuery: (kind: string, input: Record<string, string | string[] | undefined>) => Record<string, unknown>;
  serializeAdministrationQuery: (input: Record<string, unknown>) => Record<string, string | number>;
  parseAdministrationListPayload: (kind: string, payload: unknown) => unknown;
  parseAdministrationDetailPayload: (kind: string, payload: unknown) => unknown;
  controlCreateInputSchema: InputSchema;
  controlAdministrationRecordSchema: InputSchema;
  informationAssetCreateInputSchema: InputSchema;
  informationSystemCreateInputSchema: InputSchema;
  riskTypeCreateInputSchema: InputSchema;
};

/** The messages an input schema raises for a value, by field: exactly what a form shows under each field. */
function messagesFor(schema: InputSchema, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  const messages: Record<string, string[]> = {};
  for (const issue of result.error?.issues ?? []) {
    const field = issue.path.map(String).join('.');
    messages[field] = [...(messages[field] ?? []), issue.message];
  }
  return messages;
}

/* Phase 19 (19-15, D-25): the browser checks only a file's extension and size; Strapi reads everything else. */
type CsvClientParserModule = {
  checkImportFileInBrowser: (file: Pick<File, 'name' | 'size'>) => { ok: true } | { ok: false; reason: 'IMPORT_FILE_TYPE' | 'IMPORT_FILE_TOO_LARGE' };
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

  // The contract bounds a served description at 10,000 characters, so a longer one is a server defect
  // (Strapi bounds its reads): the closed record parser keeps refusing it rather than accepting it.
  it('keeps the Control record parser strict on the 10,000-character description bound', async () => {
    const schema = await loadSchema();
    const record = {
      documentId: 'boundary-control', controlNumber: 'BOUNDARY-001', name: 'Boundary Control', framework: 'Boundary Framework',
      controlType: null, controlReference: null, frameworkVersion: null, frameworkSource: null,
    };
    expect(schema.controlAdministrationRecordSchema.parse({ ...record, description: 'd'.repeat(10_000) })).toMatchObject({ description: 'd'.repeat(10_000) });
    expect(() => schema.controlAdministrationRecordSchema.parse({ ...record, description: 'd'.repeat(10_001) })).toThrow();
  });
});

/*
 * WR-04: every message an Administration create or edit form can show is the product's own copy (direction
 * section 4 Forms: what is wrong and how to fix it). The client form and the Server Action validate with these
 * schemas, so a message reads the same from either.
 */
describe('Administration validation copy', () => {
  const control = { controlNumber: 'AC-3', name: 'Access Enforcement', framework: 'NIST SP 800-53' };

  it('asks for each required field by its label when it is blank or holds only spaces', async () => {
    const schema = await loadSchema();
    expect(messagesFor(schema.riskTypeCreateInputSchema, { name: '' })).toEqual({ name: ['Enter a name.'] });
    expect(messagesFor(schema.riskTypeCreateInputSchema, { name: '   ' })).toEqual({ name: ['Enter a name.'] });
    expect(messagesFor(schema.controlCreateInputSchema, { controlNumber: ' ', name: '', framework: '  ' })).toEqual({
      controlNumber: ['Enter a control number.'],
      name: ['Enter a name.'],
      framework: ['Enter a framework.'],
    });
    expect(messagesFor(schema.informationSystemCreateInputSchema, { name: '' })).toEqual({ name: ['Enter a name.'] });
    expect(messagesFor(schema.informationAssetCreateInputSchema, { name: '  ' })).toEqual({ name: ['Enter a name.'] });
  });

  it('states each length limit as the way to meet it', async () => {
    const schema = await loadSchema();
    expect(messagesFor(schema.riskTypeCreateInputSchema, { name: 'n'.repeat(256), description: 'd'.repeat(10_001) })).toEqual({
      name: ['Use 255 characters or fewer.'],
      description: ['Use 10,000 characters or fewer.'],
    });
    expect(messagesFor(schema.controlCreateInputSchema, {
      ...control,
      controlNumber: 'c'.repeat(256),
      description: 'd'.repeat(10_001),
      controlReference: 'r'.repeat(501),
      frameworkVersion: 'v'.repeat(256),
      frameworkSource: 's'.repeat(2_001),
    })).toEqual({
      controlNumber: ['Use 255 characters or fewer.'],
      description: ['Use 10,000 characters or fewer.'],
      controlReference: ['Use 500 characters or fewer.'],
      frameworkVersion: ['Use 255 characters or fewer.'],
      frameworkSource: ['Use 2,000 characters or fewer.'],
    });
    expect(messagesFor(schema.informationSystemCreateInputSchema, {
      name: 'Customer portal', systemType: 't'.repeat(256), businessCriticality: 'b'.repeat(256), hostingLocation: 'h'.repeat(501),
    })).toEqual({
      systemType: ['Use 255 characters or fewer.'],
      businessCriticality: ['Use 255 characters or fewer.'],
      hostingLocation: ['Use 500 characters or fewer.'],
    });
    expect(messagesFor(schema.informationAssetCreateInputSchema, {
      name: 'Customer records', type: 't'.repeat(256), location: 'l'.repeat(501), integrityRating: 'i'.repeat(256), comments: 'c'.repeat(10_001),
    })).toEqual({
      type: ['Use 255 characters or fewer.'],
      location: ['Use 500 characters or fewer.'],
      integrityRating: ['Use 255 characters or fewer.'],
      comments: ['Use 10,000 characters or fewer.'],
    });
  });

  it('words the applicable controls limits in sentence case, since control is not a capitalised record term (UI-SPEC Voice)', async () => {
    const schema = await loadSchema();
    expect(messagesFor(schema.riskTypeCreateInputSchema, {
      name: 'Credential misuse',
      applicableControls: Array.from({ length: 1_001 }, (_, index) => `control-${index}`),
    })).toEqual({ applicableControls: ['Select 1,000 applicable controls or fewer.'] });
    expect(messagesFor(schema.riskTypeCreateInputSchema, { name: 'Credential misuse', applicableControls: ['control-1', 'control-1'] }))
      .toEqual({ applicableControls: ['Applicable controls must be distinct.'] });
  });

  it('names how to fix an optional Control field that holds only spaces, which the form submits as empty', async () => {
    const schema = await loadSchema();
    expect(messagesFor(schema.controlCreateInputSchema, { ...control, controlReference: '   ', frameworkVersion: ' ', frameworkSource: '  ' })).toEqual({
      controlReference: ['Enter a control reference, or leave it empty.'],
      frameworkVersion: ['Enter a framework version, or leave it empty.'],
      frameworkSource: ['Enter a framework source, or leave it empty.'],
    });
    expect(schema.controlCreateInputSchema.parse({ ...control, controlReference: null, frameworkVersion: null, frameworkSource: null }))
      .toEqual({ ...control, controlReference: null, frameworkVersion: null, frameworkSource: null });
  });
});

describe('ADMIN-04 client CSV file bounds', () => {
  /* 19-15 (D-25): the row and record caps are Strapi's reader's now; the browser keeps the 5 MB size bound. */
  it('accepts a file of exactly 5,242,880 bytes and refuses one byte more as IMPORT_FILE_TOO_LARGE', async () => {
    const parser = await loadCsvParser();
    expect(parser.checkImportFileInBrowser(new File([new Uint8Array(5_242_880)], 'exact.csv', { type: 'text/csv' }))).toEqual({ ok: true });
    expect(parser.checkImportFileInBrowser(new File([new Uint8Array(5_242_881)], 'too-large.csv', { type: 'text/csv' })))
      .toEqual({ ok: false, reason: 'IMPORT_FILE_TOO_LARGE' });
  });

  it('accepts .csv and .xlsx in any case and refuses any other extension as IMPORT_FILE_TYPE', async () => {
    const parser = await loadCsvParser();
    for (const name of ['a.csv', 'a.CSV', 'a.xlsx', 'a.XLSX']) {
      expect(parser.checkImportFileInBrowser({ name, size: 10 }), name).toEqual({ ok: true });
    }
    for (const name of ['a.xls', 'a.txt', 'a.csv.txt', 'xlsx', '.csv']) {
      expect(parser.checkImportFileInBrowser({ name, size: 10 }), name).toEqual({ ok: false, reason: 'IMPORT_FILE_TYPE' });
    }
  });
});

/*
 * Phase 19 (19-13 Task 1; D-02, D-27): the closed preview parser reads what Strapi now publishes beside the rows: the
 * ignored headers as typed (at most 50, of at most 200 characters), the informational notes, and the read-only columns
 * a reference export carries. An unknown row state, note or a 51st warning is refused.
 */
describe('CSV-02 the closed import preview parser', () => {
  const preview = (data: Record<string, unknown> = {}) => ({
    fileName: 'rt-2-headers.csv',
    previewDigest: `sha256:${'a'.repeat(64)}`,
    limits: { maxBytes: 5_242_880, maxRows: 5_000 },
    summary: { create: 2, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, similar: 0 },
    warnings: ['Owner'],
    notes: ['issues-column', 'read-only-columns'],
    readOnlyColumns: ['Owner'],
    rows: [
      { rowNumber: 2, state: 'create', naturalKey: 'Credential misuse', matchedDocumentId: null, matchedName: null, values: { name: 'Credential misuse' }, changes: [], issues: [] },
      { rowNumber: 3, state: 'create', naturalKey: 'Supplier outage', matchedDocumentId: null, matchedName: null, values: { name: 'Supplier outage' }, changes: [], issues: [] },
    ],
    ...data,
  });

  it('accepts the warnings, notes and read-only columns', async () => {
    const { csvImportPreviewDataSchema } = await import('./csv-import-schema');
    expect(csvImportPreviewDataSchema.parse(preview())).toMatchObject({ warnings: ['Owner'], notes: ['issues-column', 'read-only-columns'], readOnlyColumns: ['Owner'] });
    expect(csvImportPreviewDataSchema.safeParse(preview({ warnings: Array.from({ length: 50 }, (_, index) => `H${index}`.padEnd(200, 'h')) })).success).toBe(true);
  });

  it('refuses an unknown row state, a 51st warning, a 201-character warning and an unknown note', async () => {
    const { csvImportPreviewDataSchema } = await import('./csv-import-schema');
    const [first, second] = preview().rows;
    expect(csvImportPreviewDataSchema.safeParse(preview({ rows: [{ ...first, state: 'merged' }, second] })).success).toBe(false);
    expect(csvImportPreviewDataSchema.safeParse(preview({ warnings: Array.from({ length: 51 }, (_, index) => `H${index}`) })).success).toBe(false);
    expect(csvImportPreviewDataSchema.safeParse(preview({ warnings: ['h'.repeat(201)] })).success).toBe(false);
    expect(csvImportPreviewDataSchema.safeParse(preview({ notes: ['owner-column'] })).success).toBe(false);
  });

  /* 19-13 Task 2 (D-28): #CLEAR on an update serves the optional field as null; a flag or a required field never is. */
  it('accepts an optional value a #CLEAR emptied, and refuses a cleared flag or required field', async () => {
    const { csvImportPreviewDataSchema } = await import('./csv-import-schema');
    const [first, second] = preview().rows;
    const cleared = { ...first, state: 'update', matchedDocumentId: 'system-1', matchedName: 'Credential misuse', values: { name: 'Credential misuse', description: null }, changes: [{ field: 'description', before: 'Old', after: null }] };
    expect(csvImportPreviewDataSchema.safeParse(preview({ rows: [cleared, second] })).success).toBe(true);
    expect(csvImportPreviewDataSchema.safeParse(preview({ rows: [{ ...cleared, values: { name: null } }, second] })).success).toBe(false);
    expect(csvImportPreviewDataSchema.safeParse(preview({ rows: [{ ...cleared, values: { internetFacing: null } }, second] })).success).toBe(false);
  });

  it('requires the warnings, notes and read-only columns', async () => {
    const { csvImportPreviewDataSchema } = await import('./csv-import-schema');
    for (const key of ['warnings', 'notes', 'readOnlyColumns']) {
      const data: Record<string, unknown> = preview();
      delete data[key];
      expect(csvImportPreviewDataSchema.safeParse(data).success, key).toBe(false);
    }
  });
});

/*
 * Phase 19 (19-13 Task 3; D-02, D-30, D-32): the sixth row state. The preview summary counts `similar` beside the five
 * states and each row names the stored record's `matchedName`; the commit response carries the `resultToken`, a result
 * summary with `skipped` beside the five written-or-not states, and each similar row's `decision`. The preview and
 * result summaries are two closed schemas, because they no longer share keys.
 */
describe('CSV-03 the closed parsers for similar rows, decisions and the result token', () => {
  const previewSummary = { create: 0, update: 0, unchanged: 0, rejected: 0, ambiguous: 0, similar: 1 };
  const similarRow = {
    rowNumber: 2, state: 'similar', naturalKey: 'uat-b: core customer billing system', matchedDocumentId: 'system-b',
    matchedName: 'UAT-B: Core customer billing system', values: { name: 'UAT-B: Core customer billing system' }, changes: [], issues: [],
  };
  const preview = (data: Record<string, unknown> = {}) => ({
    fileName: 'is-1.csv', previewDigest: `sha256:${'a'.repeat(64)}`, limits: { maxBytes: 5_242_880, maxRows: 5_000 },
    summary: previewSummary, warnings: [], notes: [], readOnlyColumns: [], rows: [similarRow], ...data,
  });
  const result = (data: Record<string, unknown> = {}) => ({
    fileName: 'is-1.csv', previewDigest: `sha256:${'a'.repeat(64)}`, limits: { maxBytes: 5_242_880, maxRows: 5_000 },
    resultToken: `sha256:${'b'.repeat(64)}`,
    summary: { create: 1, update: 1, unchanged: 0, rejected: 0, ambiguous: 0, skipped: 1 }, previewChanged: 0,
    rows: [
      { rowNumber: 2, state: 'similar', naturalKey: 'uat-b: core customer billing system', decision: 'update', documentId: 'system-b', issues: [] },
      { rowNumber: 3, state: 'similar', naturalKey: 'uat-c: portal', decision: 'skip', issues: [] },
      { rowNumber: 4, state: 'create', naturalKey: 'UAT-F: New system', documentId: 'system-f', issues: [] },
    ],
    ...data,
  });

  it('lists six row states ending with similar', async () => {
    const { csvRowStates } = await import('./csv-import-schema');
    expect(csvRowStates).toEqual(['create', 'update', 'unchanged', 'rejected', 'ambiguous', 'similar']);
  });

  it('accepts a preview whose summary counts similar rows and whose rows name the stored record', async () => {
    const { csvImportPreviewDataSchema } = await import('./csv-import-schema');
    expect(csvImportPreviewDataSchema.parse(preview()).rows[0]).toMatchObject({ state: 'similar', matchedName: 'UAT-B: Core customer billing system' });
    const { similar: _similar, ...withoutSimilar } = previewSummary;
    expect(csvImportPreviewDataSchema.safeParse(preview({ summary: withoutSimilar })).success).toBe(false);
    expect(csvImportPreviewDataSchema.safeParse(preview({ rows: [{ ...similarRow, matchedDocumentId: null }] })).success).toBe(false);
    expect(csvImportPreviewDataSchema.safeParse(preview({ rows: [{ ...similarRow, matchedName: null }] })).success).toBe(false);
  });

  it('accepts a commit response with the result token, decisions and the skipped count', async () => {
    const { csvImportResultDataSchema } = await import('./csv-import-schema');
    const parsed = csvImportResultDataSchema.parse(result());
    expect(parsed.resultToken).toBe(`sha256:${'b'.repeat(64)}`);
    expect(parsed.summary.skipped).toBe(1);
    expect(parsed.rows.map((row) => row.decision)).toEqual(['update', 'skip', undefined]);
  });

  it('refuses a result summary without skipped, a missing token, a similar row without a decision and a skipped row with a record', async () => {
    const { csvImportResultDataSchema } = await import('./csv-import-schema');
    const { skipped: _skipped, ...withoutSkipped } = result().summary;
    expect(csvImportResultDataSchema.safeParse(result({ summary: withoutSkipped })).success).toBe(false);
    const { resultToken: _token, ...withoutToken } = result();
    expect(csvImportResultDataSchema.safeParse(withoutToken).success).toBe(false);
    const [updated, skipped, created] = result().rows as Array<Record<string, unknown>>;
    const { decision: _decision, ...undecided } = updated!;
    expect(csvImportResultDataSchema.safeParse(result({ rows: [undecided, skipped, created] })).success).toBe(false);
    expect(csvImportResultDataSchema.safeParse(result({ rows: [updated, { ...skipped, documentId: 'system-c' }, created] })).success).toBe(false);
    expect(csvImportResultDataSchema.safeParse(result({ rows: [updated, skipped, { ...created, decision: 'update' }] })).success).toBe(false);
  });
});
