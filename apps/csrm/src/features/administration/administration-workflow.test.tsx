import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/app/admin/risk-types', useRouter: () => router }));
vi.mock('server-only', () => ({}));

type AdministrationItem = {
  documentId: string;
  name: string;
  description: string | null;
  controlNumber?: string;
  framework?: string;
  controlType?: 'Preventive' | 'Detective' | 'Corrective' | 'Compensating' | null;
  controlReference?: string | null;
  systemType?: string | null;
  environment?: 'Production' | 'Non-production' | null;
  deploymentModel?: 'On-prem' | 'Cloud' | 'SaaS' | null;
  lifecycleState?: 'New' | 'Changed' | 'Existing' | 'Decommissioning' | null;
  internetFacing?: boolean;
  type?: string | null;
  dataClassification?: 'Public' | 'Internal' | 'Restricted' | 'Critical Infrastructure Sensitive' | null;
  containsPersonalData?: boolean;
  containsLegalData?: boolean;
  containsCreditCardData?: boolean;
};
type AdministrationWorkspaceProps = {
  kind: 'risk-types' | 'controls' | 'information-systems' | 'information-assets';
  state: 'ready' | 'loading' | 'empty' | 'error' | 'permission';
  items: readonly AdministrationItem[];
  query: { q: string; sort: string; page: number; pageSize: number; framework?: string; controlType?: string };
  pagination: { page: number; pageSize: number; pageCount: number; total: number };
  onSearch: (value: string) => void;
};
type AdministrationFormProps = {
  kind: 'risk-types' | 'controls' | 'information-systems' | 'information-assets';
  mode: 'create' | 'edit';
  documentId?: string;
  initialValues?: { name: string; description: string | null; applicableControls?: readonly string[] };
  initialControlOptions?: readonly { documentId: string; label: string }[];
  createAction?: (input: unknown) => Promise<unknown>;
  updateAction?: (input: unknown) => Promise<unknown>;
};
type CsvPreviewRow = { rowNumber: number; naturalKey: string; state: 'create' | 'update' | 'unchanged' | 'rejected' | 'ambiguous'; issues: readonly string[] };
type CsvImportFlowProps = {
  kind: 'risk-types' | 'controls' | 'information-systems' | 'information-assets';
  previewAction: (formData: FormData) => Promise<unknown>;
  commitAction: (formData: FormData) => Promise<unknown>;
};
type WorkspaceModule = {
  AdministrationForm: ComponentType<AdministrationFormProps>;
  AdministrationWorkspace: ComponentType<AdministrationWorkspaceProps>;
};
type ImportModule = { CsvImportFlow: ComponentType<CsvImportFlowProps> };

async function loadWorkspace(): Promise<WorkspaceModule> {
  const modulePath = './administration-workspace';
  return import(modulePath) as Promise<WorkspaceModule>;
}

async function loadImportFlow(): Promise<ImportModule> {
  const modulePath = './csv-import-flow';
  return import(modulePath) as Promise<ImportModule>;
}

const item = { documentId: 'risk-type-1', name: 'Credential misuse', description: 'Reusable definition' };
const baseWorkspaceProps: AdministrationWorkspaceProps = {
  kind: 'risk-types', state: 'ready', items: [item],
  query: { q: '', sort: 'name:asc', page: 1, pageSize: 25 },
  pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 },
  onSearch: vi.fn(),
};

function previewData(rows: readonly CsvPreviewRow[]) {
  const normalizedRows = rows.map((row) => ({
    rowNumber: row.rowNumber,
    naturalKey: row.naturalKey,
    state: row.state,
    matchedDocumentId: row.state === 'update' || row.state === 'unchanged' ? `matched-${row.rowNumber}` : null,
    values: { name: row.naturalKey },
    changes: row.state === 'update' ? [{ field: 'description', before: 'Before', after: 'After' }] : [],
    issues: row.issues.map((message) => ({ code: 'ROW_ISSUE', field: null, message })),
  }));
  const summary = Object.fromEntries(['create', 'update', 'unchanged', 'rejected', 'ambiguous'].map((state) => [state, normalizedRows.filter((row) => row.state === state).length]));
  return { fileName: 'risk-types.csv', previewDigest: `sha256:${'1'.repeat(64)}`, limits: { maxBytes: 5_242_880, maxRows: 5_000 }, summary, rows: normalizedRows };
}

async function renderPreview(CsvImportFlow: ImportModule['CsvImportFlow'], rows: readonly CsvPreviewRow[], commitAction = vi.fn()) {
  const user = userEvent.setup();
  const previewAction = vi.fn().mockResolvedValue({ ok: true, data: previewData(rows) });
  const view = render(<CsvImportFlow kind="risk-types" previewAction={previewAction} commitAction={commitAction} />);
  await user.click(screen.getByRole('button', { name: 'Choose CSV file' }));
  await user.upload(screen.getByLabelText(/CSV file/i), new File(['name,description\r\nExample,value'], 'risk-types.csv', { type: 'text/csv' }));
  await user.click(screen.getByRole('button', { name: 'Validate and preview' }));
  const previewHeading = await screen.findByRole('heading', { level: 2, name: 'Review rows' });
  expect(previewHeading).toHaveClass('text-heading-lg');
  return { user, previewAction, commitAction, view };
}

describe('ADMIN-01 ADMIN-02 ADMIN-03 administration workspace', () => {
  it('renders an honest responsive list with canonical actions and no delete', async () => {
    const { AdministrationWorkspace } = await loadWorkspace();
    render(<AdministrationWorkspace {...baseWorkspaceProps} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Risk Types' })).toBeInTheDocument();
    expect(screen.getByText('1 result')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create Risk Type' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import CSV' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Risk Types results' })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="data-table-mobile"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('renders bounded Control states and submits only the closed reusable-Control fields', async () => {
    const user = userEvent.setup();
    const { AdministrationForm, AdministrationWorkspace } = await loadWorkspace();
    const control = {
      documentId: 'control-1',
      controlNumber: 'AC-2',
      name: 'Account Management',
      description: 'Reusable definition',
      framework: 'NIST SP 800-53',
      controlType: 'Preventive' as const,
      controlReference: 'AC-2',
    };
    const view = render(<AdministrationWorkspace
      {...baseWorkspaceProps}
      kind="controls"
      items={[control]}
      pagination={{ page: 1, pageSize: 25, pageCount: 106, total: 2_646 }}
      query={{ q: '', framework: '', controlType: '', sort: 'controlNumber:asc', page: 1, pageSize: 25 }}
    />);
    expect(screen.getByRole('heading', { level: 1, name: 'Controls' })).toBeInTheDocument();
    expect(screen.getByText('2,646 results')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search Controls' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Framework' })).toBeInTheDocument();
    const controlTypeFilter = screen.getByRole('combobox', { name: 'Control type' });
    expect(controlTypeFilter).toHaveClass('h-9', 'rounded-md', 'bg-surface', 'block', 'w-full');
    expect(controlTypeFilter.closest('label')).toHaveClass('space-y-1');
    expect(screen.getByRole('table', { name: 'Controls results' })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="data-table-mobile"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();

    view.unmount();
    const createAction = vi.fn().mockResolvedValue({ ok: true, data: control });
    render(<AdministrationForm kind="controls" mode="create" createAction={createAction} />);
    await user.type(screen.getByRole('textbox', { name: 'Control number' }), 'AC-2');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Account Management');
    await user.type(screen.getByRole('textbox', { name: /^Framework$/ }), 'NIST SP 800-53');
    const controlTypeField = screen.getByRole('combobox', { name: 'Control type' });
    expect(controlTypeField).toHaveClass('h-9', 'rounded-md', 'bg-surface', 'w-full');
    await user.selectOptions(controlTypeField, 'Preventive');
    await user.click(screen.getByRole('button', { name: 'Create Control' }));
    expect(createAction).toHaveBeenCalledWith({ values: {
      controlNumber: 'AC-2',
      name: 'Account Management',
      framework: 'NIST SP 800-53',
      controlType: 'Preventive',
      description: null,
      controlReference: null,
      frameworkVersion: null,
      frameworkSource: null,
    } });
    expect(screen.queryByLabelText(/source data/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('renders complete Information System and Information Asset lists and closed forms', async () => {
    const { AdministrationForm, AdministrationWorkspace } = await loadWorkspace();
    const system = {
      documentId: 'system-1', name: 'Customer portal', description: 'Production service',
      systemType: 'Web application', environment: 'Production' as const, deploymentModel: 'Cloud' as const,
      lifecycleState: 'Existing' as const, internetFacing: true,
    };
    const view = render(<AdministrationWorkspace
      {...baseWorkspaceProps}
      kind="information-systems"
      items={[system]}
    />);
    expect(screen.getByRole('heading', { level: 1, name: 'Information Systems' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Environment' })).toBeInTheDocument();
    expect(screen.getAllByText('Yes').length).toBeGreaterThan(0);
    view.unmount();

    const asset = {
      documentId: 'asset-1', name: 'Customer records', description: 'Restricted records', type: 'Dataset',
      dataClassification: 'Restricted' as const, containsPersonalData: true, containsLegalData: false,
      containsCreditCardData: true,
    };
    const assetView = render(<AdministrationWorkspace
      {...baseWorkspaceProps}
      kind="information-assets"
      items={[asset]}
    />);
    expect(screen.getByRole('heading', { level: 1, name: 'Information Assets' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Classification' })).toBeInTheDocument();
    expect(screen.getAllByText(/Personal: Yes/).length).toBeGreaterThan(0);
    assetView.unmount();

    const systemAction = vi.fn().mockResolvedValue({ ok: true, data: system });
    render(<AdministrationForm kind="information-systems" mode="create" createAction={systemAction} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Create Information System' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Environment' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Deployment model' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Lifecycle state' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Owner' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Yes, internet-facing' })).toBeInTheDocument();
  });

  it('keeps loading, first-use empty, filtered empty, error, and permission states non-enumerating', async () => {
    const { AdministrationWorkspace } = await loadWorkspace();
    const view = render(<AdministrationWorkspace {...baseWorkspaceProps} state="loading" items={[]} />);
    expect(screen.getByRole('status', { name: 'Loading Risk Types' })).toBeInTheDocument();
    expect(screen.queryByText(/result/i)).not.toBeInTheDocument();

    view.rerender(<AdministrationWorkspace {...baseWorkspaceProps} state="empty" items={[]} pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} />);
    expect(screen.getByRole('heading', { name: 'No Risk Types yet' })).toBeInTheDocument();
    view.rerender(<AdministrationWorkspace {...baseWorkspaceProps} state="empty" items={[]} query={{ ...baseWorkspaceProps.query, q: 'missing' }} pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} />);
    expect(screen.getByRole('heading', { name: 'No Risk Types match these filters' })).toBeInTheDocument();

    view.rerender(<AdministrationWorkspace {...baseWorkspaceProps} state="error" items={[]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load Risk Types');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    view.rerender(<AdministrationWorkspace {...baseWorkspaceProps} state="permission" items={[]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to Administration records');
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.queryByText(/result/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create|import/i })).not.toBeInTheDocument();
  });

  it('debounces search by 700 ms, submits on Enter, and suppresses stale results', async () => {
    vi.useFakeTimers();
    try {
      const { AdministrationWorkspace } = await loadWorkspace();
      const onSearch = vi.fn();
      render(<AdministrationWorkspace {...baseWorkspaceProps} onSearch={onSearch} />);
      const search = screen.getByRole('searchbox', { name: 'Search Risk Types' });
      fireEvent.change(search, { target: { value: 'credential' } });
      expect(onSearch).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(699);
      expect(onSearch).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(onSearch).toHaveBeenLastCalledWith('credential');
      fireEvent.change(search, { target: { value: 'misuse' } });
      fireEvent.keyDown(search, { key: 'Enter' });
      expect(onSearch).toHaveBeenLastCalledWith('misuse');
      await vi.advanceTimersByTimeAsync(700);
      expect(onSearch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounces the locally controlled framework filter without dropping typed text', async () => {
    vi.useFakeTimers();
    try {
      router.replace.mockClear();
      const { AdministrationWorkspace } = await loadWorkspace();
      render(<AdministrationWorkspace {...baseWorkspaceProps} kind="controls" query={{ q: '', framework: '', controlType: '', sort: 'controlNumber:asc', page: 1, pageSize: 25 }} />);
      const framework = screen.getByRole('combobox', { name: 'Framework' });
      fireEvent.change(framework, { target: { value: 'NIST' } });
      expect(framework).toHaveValue('NIST');
      expect(router.replace).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(700);
      expect(router.replace).toHaveBeenCalledWith(expect.stringContaining('framework=NIST'), { scroll: false });
    } finally { vi.useRealTimers(); }
  });

  it('names boolean fieldsets and exposes Applicable Controls combobox state', async () => {
    const { AdministrationForm } = await loadWorkspace();
    const view = render(<AdministrationForm kind="information-systems" mode="create" createAction={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Internet-facing' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'External access required' })).toBeInTheDocument();
    view.unmount();
    render(<AdministrationForm kind="risk-types" mode="create" createAction={vi.fn()} initialControlOptions={[{ documentId: 'control-1', label: 'AC-1 · Access control' }]} />);
    const combobox = screen.getByRole('combobox', { name: 'Applicable Controls' });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    expect(combobox).toHaveAttribute('aria-controls', 'applicable-control-options');
    expect(screen.getByRole('status')).toHaveTextContent('1 Control options available.');
  });

  it('offers Create for first use, Clear filters for filtered empty, and submits blank Risk Type descriptions as null', async () => {
    const user = userEvent.setup();
    const { AdministrationForm, AdministrationWorkspace } = await loadWorkspace();
    const view = render(<AdministrationWorkspace {...baseWorkspaceProps} state="empty" items={[]} pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} />);
    expect(screen.getAllByRole('link', { name: 'Create Risk Type' })).toHaveLength(2);
    view.rerender(<AdministrationWorkspace {...baseWorkspaceProps} state="empty" items={[]} query={{ ...baseWorkspaceProps.query, q: 'missing' }} pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} />);
    const filteredEmptyState = screen
      .getByRole('heading', { name: 'No Risk Types match these filters' })
      .closest('section');
    expect(filteredEmptyState).not.toBeNull();
    expect(within(filteredEmptyState as HTMLElement).getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    view.unmount();
    const createAction = vi.fn().mockResolvedValue({ ok: true, data: item });
    render(<AdministrationForm kind="risk-types" mode="create" createAction={createAction} />);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Nullable description');
    await user.click(screen.getByRole('button', { name: 'Create Risk Type' }));
    expect(createAction).toHaveBeenCalledWith({ values: { name: 'Nullable description', description: null, applicableControls: [] } });
  });

  it('creates a Risk Type with exact fields, retained values, and no delete affordance', async () => {
    const user = userEvent.setup();
    const { AdministrationForm } = await loadWorkspace();
    const createAction = vi.fn().mockResolvedValue({
      ok: false,
      values: { name: 'Credential misuse', description: 'Reusable definition', applicableControls: [] },
      fieldErrors: { name: ['A Risk Type with this name already exists.'] },
      formError: 'A Risk Type with this name already exists.',
    });
    render(<AdministrationForm kind="risk-types" mode="create" createAction={createAction} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Create Risk Type' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Credential misuse');
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Reusable definition');
    await user.click(screen.getByRole('button', { name: 'Create Risk Type' }));

    expect(createAction).toHaveBeenCalledWith({ values: {
      name: 'Credential misuse', description: 'Reusable definition', applicableControls: [],
    } });
    expect((await screen.findAllByText('A Risk Type with this name already exists.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Credential misuse');
    expect(screen.getByRole('link', { name: 'Return to Risk Types' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('renders detail context and saves edited Risk Type values', async () => {
    const user = userEvent.setup();
    const { AdministrationForm } = await loadWorkspace();
    const updateAction = vi.fn().mockResolvedValue({ ok: true, data: item });
    render(<AdministrationForm
      documentId={item.documentId}
      initialValues={{ ...item, applicableControls: [] }}
      kind="risk-types"
      mode="edit"
      updateAction={updateAction}
    />);

    expect(screen.getByRole('heading', { level: 1, name: item.name })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Downstream use' })).toBeInTheDocument();
    await user.clear(screen.getByRole('textbox', { name: 'Description' }));
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Updated reusable definition');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(updateAction).toHaveBeenCalledWith({
      documentId: item.documentId,
      values: { description: 'Updated reusable definition' },
    });
  });
});

describe('ADMIN-04 five-step CSV import workflow', () => {
  it('configures an exact import route for every closed Administration collection', async () => {
    const { administrationKinds, getAdministrationConfig } = await import('./administration-config');
    expect(administrationKinds.map((kind) => getAdministrationConfig(kind).importPath)).toEqual([
      '/app/admin/risk-types/import',
      '/app/admin/controls/import',
      '/app/admin/information-systems/import',
      '/app/admin/information-assets/import',
    ]);
  });

  it('renders each collection from the shared import workflow and its closed CSV columns', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const cases = [
      { kind: 'risk-types', label: 'Risk Types', column: 'name', listPath: '/app/admin/risk-types' },
      { kind: 'controls', label: 'Controls', column: 'controlNumber', listPath: '/app/admin/controls' },
      { kind: 'information-systems', label: 'Information Systems', column: 'environment', listPath: '/app/admin/information-systems' },
      { kind: 'information-assets', label: 'Information Assets', column: 'dataClassification', listPath: '/app/admin/information-assets' },
    ] as const;
    for (const candidate of cases) {
      const view = render(<CsvImportFlow kind={candidate.kind} previewAction={vi.fn()} commitAction={vi.fn()} />);
      expect(screen.getByRole('heading', { level: 1, name: `Import ${candidate.label} from CSV` })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: candidate.column })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: `Return to ${candidate.label}` })).toHaveAttribute('href', candidate.listPath);
      view.unmount();
    }
  });

  it('shows all five ordered steps and all five row classifications', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const rows: CsvPreviewRow[] = [
      { rowNumber: 2, naturalKey: 'Create', state: 'create', issues: [] },
      { rowNumber: 3, naturalKey: 'Update', state: 'update', issues: [] },
      { rowNumber: 4, naturalKey: 'Unchanged', state: 'unchanged', issues: [] },
      { rowNumber: 5, naturalKey: 'Rejected', state: 'rejected', issues: ['name: Enter a name.'] },
      { rowNumber: 6, naturalKey: 'Ambiguous', state: 'ambiguous', issues: ['name: Multiple matches.'] },
    ];
    await renderPreview(CsvImportFlow, rows);
    const steps = screen.getByRole('list', { name: 'Import progress' });
    for (const step of ['Guidance', 'Select file', 'Review rows', 'Confirm import', 'Results']) {
      expect(within(steps).getByText(step)).toBeInTheDocument();
    }
    for (const state of ['Create', 'Update', 'Unchanged', 'Rejected', 'Ambiguous']) {
      expect(screen.getByRole('button', { name: new RegExp(`${state} \\(1\\)`) })).toBeInTheDocument();
      expect(screen.getByRole('row', { name: new RegExp(state, 'i') })).toBeInTheDocument();
    }
  });

  it('paginates preview rows at 100 and exposes the mobile card presentation', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const rows = Array.from({ length: 101 }, (_, index): CsvPreviewRow => ({ rowNumber: index + 2, naturalKey: `Row ${index}`, state: 'create', issues: [] }));
    const { user } = await renderPreview(CsvImportFlow, rows);
    expect(screen.getByRole('table', { name: 'Risk Type import preview' }).querySelectorAll('tbody tr')).toHaveLength(100);
    expect(document.querySelectorAll('[data-slot="csv-import-mobile"] article')).toHaveLength(100);
    await user.click(screen.getByRole('button', { name: 'Next rows' }));
    expect(screen.getByRole('table', { name: 'Risk Type import preview' }).querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('rejects file bounds before preview service invocation', async () => {
    const user = userEvent.setup();
    const { CsvImportFlow } = await loadImportFlow();
    const previewAction = vi.fn();
    render(<CsvImportFlow kind="risk-types" previewAction={previewAction} commitAction={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Choose CSV file' }));
    const file = new File([new Uint8Array(5_242_881)], 'too-large.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/CSV file/i), file);
    await user.click(screen.getByRole('button', { name: 'Validate and preview' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/too large|5 MiB/i);
    expect(previewAction).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation and never writes unchanged, rejected, or ambiguous rows', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const rows = [
        { rowNumber: 2, naturalKey: 'Create', state: 'create', issues: [] },
        { rowNumber: 3, naturalKey: 'Unchanged', state: 'unchanged', issues: [] },
        { rowNumber: 4, naturalKey: 'Rejected', state: 'rejected', issues: [] },
        { rowNumber: 5, naturalKey: 'Ambiguous', state: 'ambiguous', issues: [] },
      ] as CsvPreviewRow[];
    const result = previewData(rows);
    const commitAction = vi.fn().mockResolvedValue({ ok: true, data: { ...result, previewChanged: 0, rows: result.rows } });
    const { user } = await renderPreview(CsvImportFlow, rows, commitAction);
    await user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    const confirm = screen.getByRole('button', { name: 'Confirm import' });
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'I have reviewed the create and update rows.' }));
    await user.click(confirm);
    expect(commitAction).toHaveBeenCalledTimes(1);
    const submitted = commitAction.mock.calls[0]?.[0] as FormData;
    expect(submitted.get('confirmed')).toBe('true');
    expect(submitted.get('previewDigest')).toBe(`sha256:${'1'.repeat(64)}`);
  });

  it('traverses backward and forward with focus, live status, authoritative results, and no automatic retry', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const commitAction = vi.fn().mockResolvedValue({ ok: true, data: {
      fileName: 'risk-types.csv', previewDigest: `sha256:${'1'.repeat(64)}`, limits: { maxBytes: 5_242_880, maxRows: 5_000 },
      summary: { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 1 },
      previewChanged: 1,
      rows: [
        { rowNumber: 2, naturalKey: 'Create', state: 'create', documentId: 'risk-type-2', issues: [] },
        { rowNumber: 3, naturalKey: 'Update', state: 'update', documentId: 'risk-type-3', issues: [] },
        { rowNumber: 4, naturalKey: 'Unchanged', state: 'unchanged', issues: [] },
        { rowNumber: 5, naturalKey: 'Rejected', state: 'rejected', issues: [{ message: 'Still invalid.' }] },
        { rowNumber: 6, naturalKey: 'Ambiguous', state: 'ambiguous', issues: [{ message: 'Still ambiguous.' }] },
      ],
    } });
    const previewRows: CsvPreviewRow[] = [
      { rowNumber: 2, naturalKey: 'Create', state: 'create', issues: [] },
      { rowNumber: 3, naturalKey: 'Update', state: 'update', issues: [] },
      { rowNumber: 4, naturalKey: 'Unchanged', state: 'unchanged', issues: [] },
      { rowNumber: 5, naturalKey: 'Rejected', state: 'rejected', issues: ['name: Enter a name.'] },
      { rowNumber: 6, naturalKey: 'Ambiguous', state: 'ambiguous', issues: ['name: Multiple matches.'] },
    ];
    const first = await renderPreview(CsvImportFlow, previewRows, commitAction);
    const user = first.user;
    await user.click(screen.getByRole('button', { name: 'Back to file selection' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Select file' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Back to guidance' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Guidance' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Step 1 of 5: Guidance');

    first.view.unmount();
    const second = await renderPreview(CsvImportFlow, previewRows, commitAction);
    await second.user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    await second.user.click(screen.getByRole('checkbox', { name: 'I have reviewed the create and update rows.' }));
    await second.user.click(screen.getByRole('button', { name: 'Confirm import' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Import completed with rejected rows' })).toHaveFocus();
    for (const text of ['Created 1', 'Updated 1', 'Unchanged 1', 'Rejected 1', 'Ambiguous 1']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByText(/Server validation changed the result for 1 row/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Risk Types' })).toHaveAttribute('href', '/app/admin/risk-types');
    expect(commitAction).toHaveBeenCalledTimes(1);
  });
});

describe('ADMIN-01 capability-gated Administration discovery', () => {
  it('grants and renders the Administration group only for Bob', async () => {
    const [{ DevelopmentCapabilityAdapter }, { CapabilityNavigation }] = await Promise.all([
      import('@/lib/capabilities/development-capabilities'),
      import('@/components/shell/capability-navigation'),
    ]);
    const bob = await new DevelopmentCapabilityAdapter('Security Analyst').granted();
    const jane = await new DevelopmentCapabilityAdapter('Requestor').granted();

    expect(bob.has('administration:manage' as never)).toBe(true);
    expect(jane.has('administration:manage' as never)).toBe(false);
    const view = render(<CapabilityNavigation granted={bob} />);
    expect(screen.getByRole('group', { name: 'Administration' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Risk Types' })).toHaveAttribute('href', '/app/admin/risk-types');
    expect(screen.getByRole('link', { name: 'Controls' })).toHaveAttribute('href', '/app/admin/controls');
    expect(screen.getByRole('link', { name: 'Information Systems' })).toHaveAttribute('href', '/app/admin/information-systems');
    expect(screen.getByRole('link', { name: 'Information Assets' })).toHaveAttribute('href', '/app/admin/information-assets');
    view.rerender(<CapabilityNavigation granted={jane} />);
    expect(screen.queryByRole('group', { name: 'Administration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Risk Types' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Information Systems' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Information Assets' })).not.toBeInTheDocument();
  });
});
