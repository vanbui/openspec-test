import '@testing-library/jest-dom/vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { installTestResizeObserver, stubHorizontalGeometry, TestResizeObserver } from '@/test/layout-stubs';
import { applicableControlOptions } from './applicable-controls';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const get = vi.hoisted(() => vi.fn());
const importMocks = vi.hoisted(() => ({ saveFile: vi.fn(), toastSuccess: vi.fn(), toastDismiss: vi.fn() }));
vi.mock('@/lib/files/save-file', () => ({ saveFile: importMocks.saveFile }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: importMocks.toastSuccess, dismiss: importMocks.toastDismiss, error: vi.fn() }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/app/admin/risk-types', useRouter: () => router }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: vi.fn(async () => ({ GET: get })),
  normalizeTransportError: vi.fn((_error: unknown, status?: number) => ({ data: null, error: { status } })),
}));

type AdministrationItem = {
  documentId: string;
  name: string;
  description: string | null;
  controlNumber?: string;
  framework?: string;
  controlType?: 'Preventive' | 'Detective' | 'Corrective' | 'Compensating' | null;
  controlReference?: string | null;
  systemType?: string | null;
  owner?: string | null;
  ownerName?: string | null;
  businessCriticality?: string | null;
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
  exportButton?: ReactNode;
};
type AdministrationFormProps = {
  kind: 'risk-types' | 'controls' | 'information-systems' | 'information-assets';
  mode: 'create' | 'edit';
  documentId?: string;
  initialValues?: { name: string; description: string | null; applicableControls?: readonly string[]; owner?: string | null; ownerName?: string | null; businessCriticality?: string | null; controlNumber?: string; framework?: string };
  initialControlOptions?: readonly { documentId: string; label: string }[];
  createAction?: (input: unknown) => Promise<unknown>;
  updateAction?: (input: unknown) => Promise<unknown>;
};
type CsvPreviewRow = { rowNumber: number; naturalKey: string; state: 'create' | 'update' | 'unchanged' | 'rejected' | 'ambiguous' | 'similar'; issues: readonly string[] };
type CsvImportFlowProps = {
  kind: 'risk-types' | 'controls' | 'information-systems' | 'information-assets';
  previewAction: (formData: FormData) => Promise<unknown>;
  commitAction: (formData: FormData) => Promise<unknown>;
  templateAction?: (input: unknown) => Promise<unknown>;
  errorReportAction?: (formData: FormData) => Promise<unknown>;
};
type WorkspaceModule = {
  AdministrationAccessDenied: ComponentType<{ kind?: AdministrationWorkspaceProps['kind'] }>;
  AdministrationForm: ComponentType<AdministrationFormProps>;
  AdministrationWorkspace: ComponentType<AdministrationWorkspaceProps>;
};
type ImportModule = { CsvImportFlow: ComponentType<CsvImportFlowProps> };

async function loadWorkspace(): Promise<WorkspaceModule> {
  const workspacePath = './administration-workspace';
  const formPath = './administration-form';
  const [workspace, form] = await Promise.all([import(workspacePath), import(formPath)]);
  return { ...workspace, ...form } as WorkspaceModule;
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
    matchedDocumentId: row.state === 'update' || row.state === 'unchanged' || row.state === 'similar' ? `matched-${row.rowNumber}` : null,
    matchedName: row.state === 'similar' ? `Stored ${row.naturalKey}` : row.state === 'update' || row.state === 'unchanged' ? row.naturalKey : null,
    values: { name: row.naturalKey },
    changes: row.state === 'update' ? [{ field: 'description', before: 'Before', after: 'After' }] : [],
    issues: row.issues.map((message) => ({ code: 'ROW_ISSUE', field: null, message })),
  }));
  const summary = Object.fromEntries(['create', 'update', 'unchanged', 'rejected', 'ambiguous', 'similar'].map((state) => [state, normalizedRows.filter((row) => row.state === state).length]));
  return { fileName: 'risk-types.csv', previewDigest: `sha256:${'1'.repeat(64)}`, limits: { maxBytes: 5_242_880, maxRows: 5_000 }, summary, warnings: [] as string[], notes: [] as string[], readOnlyColumns: [] as string[], rows: normalizedRows };
}

async function renderPreview(
  CsvImportFlow: ImportModule['CsvImportFlow'],
  rows: readonly CsvPreviewRow[],
  commitAction = vi.fn(),
  extra: Partial<ReturnType<typeof previewData>> = {},
  actions: Pick<CsvImportFlowProps, 'errorReportAction' | 'templateAction'> = {},
) {
  const user = userEvent.setup();
  const previewAction = vi.fn().mockResolvedValue({ ok: true, data: { ...previewData(rows), ...extra } });
  const view = render(<CsvImportFlow kind="risk-types" previewAction={previewAction} commitAction={commitAction} {...actions} />);
  await user.click(screen.getByRole('button', { name: 'Choose file' }));
  await user.upload(screen.getByLabelText('File to import', { selector: 'input' }), new File(['name,description\r\nExample,value'], 'risk-types.csv', { type: 'text/csv' }));
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
    // 19-UI-SPEC §1, §10: `Import` (was `Import CSV`), and no Export unless the page passes one.
    expect(screen.getByRole('link', { name: 'Import' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Export/ })).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Risk Types results' })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="data-table-mobile"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  /*
   * 19-15 (19-UI-SPEC §1, UI-D1, X-30; the Export placement pattern): Export is the header wrapper's last child, after
   * Create {singular} and Import, inside the unchanged md:flex-row-reverse wrapper, so Create keeps its place on desktop.
   */
  it('places Export last in the header, after Create and Import, inside the unchanged reversed wrapper', async () => {
    const { AdministrationWorkspace } = await loadWorkspace();
    render(<AdministrationWorkspace {...baseWorkspaceProps} exportButton={<button type="button">Export Risk Types</button>} />);
    const create = screen.getByRole('link', { name: 'Create Risk Type' });
    const wrapper = create.parentElement!;
    expect(wrapper).toHaveClass('flex', 'w-full', 'flex-col', 'gap-2', 'md:w-auto', 'md:flex-row-reverse');
    expect(Array.from(wrapper.children).map((child) => child.textContent)).toEqual(['Create Risk Type', 'Import', 'Export Risk Types']);
    expect(screen.getByRole('link', { name: 'Import' })).toHaveAttribute('href', '/app/admin/risk-types/import');
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
    expect(controlTypeFilter.closest('label')).toHaveClass('grid', 'gap-1.5');
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

  /*
   * D-36 (UI-SPEC §16.2): the controls list shows each control number once. The Name column carries the
   * title part only, `Not provided` for an untitled control; the mobile card and the edit page title use
   * the control label.
   */
  it('UAT-007 shows each control number once in the controls list, its mobile card and the edit title', async () => {
    const { AdministrationForm, AdministrationWorkspace } = await loadWorkspace();
    const privacy = {
      documentId: 'control-app-11', controlNumber: 'APP-11', name: 'APP-11 — Security of personal information',
      description: '11.1 If an APP entity holds personal information', framework: 'Privacy Act 1988 (Cth)',
      controlType: null, controlReference: 'Schedule 1, APP 11',
    };
    const untitled = {
      documentId: 'control-5-1', controlNumber: '5.1', name: '5.1', description: null,
      framework: 'ISO/IEC 27001 Information security management systems — Annex A', controlType: null, controlReference: null,
    };
    const view = render(<AdministrationWorkspace
      {...baseWorkspaceProps}
      kind="controls"
      items={[privacy, untitled]}
      pagination={{ page: 1, pageSize: 25, pageCount: 1, total: 2 }}
      query={{ q: '', framework: '', controlType: '', sort: 'controlNumber:asc', page: 1, pageSize: 25 }}
    />);

    const table = screen.getByRole('table', { name: 'Controls results' });
    const cellsOf = (number: string) => within(within(table).getAllByRole('row').find((row) => within(row).queryAllByRole('cell')[0]?.textContent === number)!)
      .getAllByRole('cell').map((cell) => cell.textContent);
    expect(cellsOf('APP-11').slice(0, 2)).toEqual(['APP-11', 'Security of personal information']);
    expect(cellsOf('5.1').slice(0, 2)).toEqual(['5.1', 'Not provided']);
    expect(cellsOf('5.1').filter((text) => text === '5.1')).toHaveLength(1);

    const cards = screen.getByRole('list', { name: 'Controls results' });
    expect(within(cards).getByRole('link', { name: 'APP-11 · Security of personal information' })).toBeInTheDocument();
    expect(within(cards).getByRole('link', { name: '5.1 · ISO/IEC 27001 Information security management systems — Annex A' })).toBeInTheDocument();
    expect(cards.textContent).not.toContain('APP-11 · APP-11');
    view.unmount();

    render(<AdministrationForm kind="controls" mode="edit" documentId="control-app-11" initialValues={privacy} updateAction={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'APP-11 · Security of personal information' })).toBeInTheDocument();
    // The Name field holds the stored value unchanged: it is the data being edited.
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('APP-11 — Security of personal information');
  });

  /*
   * B3 (10-23 walkthrough fix 7): a long-text column wraps within 14rem to 28rem and clamps to two lines
   * (direction §4 DataTable, X-3), so a long control title never forces the controls table wide at 1440.
   * The control title and framework name and the Risk Type description are the long text; identifiers,
   * types and references stay on one line.
   */
  it('B3 wraps long control titles, framework names and Risk Type descriptions within the long-text bounds', async () => {
    const { AdministrationWorkspace } = await loadWorkspace();
    const title = 'Preventing, withstanding and recovering from critical operation disruption where practicable';
    const framework = 'Privacy Act 1988 — Australian Privacy Principles and Notifiable Data Breaches scheme';
    const control = {
      documentId: 'control-cps-230-13', controlNumber: 'CPS-230-13', name: `CPS-230-13 — ${title}`,
      description: 'An APRA-regulated entity must…', framework, controlType: 'Preventive' as const, controlReference: 'Clause 13',
    };
    const controlsView = render(<AdministrationWorkspace
      {...baseWorkspaceProps}
      kind="controls"
      items={[control]}
      query={{ q: '', framework: '', controlType: '', sort: 'controlNumber:asc', page: 1, pageSize: 25 }}
    />);
    const controlsTable = screen.getByRole('table', { name: 'Controls results' });
    const longTextCell = (text: string) => within(controlsTable).getByText(text, { exact: true }).closest('td');
    for (const text of [title, framework]) {
      // The clamp is visual: the whole text stays in the DOM.
      expect(within(controlsTable).getByText(text, { exact: true })).toHaveClass('line-clamp-2');
      expect(longTextCell(text)).toHaveClass('whitespace-normal', 'min-w-56', 'max-w-md');
    }
    for (const text of ['CPS-230-13', 'Preventive', 'Clause 13']) {
      expect(within(controlsTable).getByText(text, { exact: true }).closest('td')).not.toHaveClass('whitespace-normal');
    }
    expect(screen.getByRole('columnheader', { name: /Name/ })).not.toHaveClass('whitespace-normal');
    controlsView.unmount();

    const description = 'Credentials are misused through phishing, reuse or theft and grant access to customer records and administrative consoles.';
    render(<AdministrationWorkspace {...baseWorkspaceProps} items={[{ ...item, description }]} />);
    const riskTypesTable = screen.getByRole('table', { name: 'Risk Types results' });
    expect(within(riskTypesTable).getByText(description, { exact: true }).closest('td')).toHaveClass('whitespace-normal', 'min-w-56', 'max-w-md');
    expect(within(riskTypesTable).getByRole('link', { name: 'Credential misuse' }).closest('td')).not.toHaveClass('whitespace-normal');
  });

  /*
   * WR-309: the other free-text columns (a Reference or a Location of up to 500 characters; a Name, an Owner or a
   * Business criticality of up to 255) are bounded too. Each is capped at the long-text maximum (28rem) and clamps to
   * two lines, with the full text in the DOM, so one long value cannot push the other columns out of view. They
   * keep no 14rem minimum: these are names and short labels, and short values keep compact columns (Fix 7).
   */
  it('caps long names, references, locations, owners and criticality at the long-text width and clamps them (WR-309)', async () => {
    const { AdministrationWorkspace } = await loadWorkspace();
    const long = (label: string, length: number) => `${label} `.repeat(Math.ceil(length / (label.length + 1))).slice(0, length).trim();
    const bounded = (element: HTMLElement) => expect(element).toHaveClass('line-clamp-2', 'max-w-md', 'whitespace-normal');

    const reference = long('Section 4.2.1(a) of the operational resilience standard', 500);
    const controlsView = render(<AdministrationWorkspace
      {...baseWorkspaceProps}
      kind="controls"
      items={[{ documentId: 'control-1', controlNumber: 'AC-1', name: 'AC-1 — Access control', description: null, framework: 'NIST SP 800-53', controlType: 'Preventive', controlReference: reference }]}
      query={{ q: '', framework: '', controlType: '', sort: 'controlNumber:asc', page: 1, pageSize: 25 }}
    />);
    bounded(within(screen.getByRole('table', { name: 'Controls results' })).getByText(reference, { exact: true }));
    controlsView.unmount();

    const riskTypeName = long('Credential misuse through phishing', 255);
    const riskTypesView = render(<AdministrationWorkspace {...baseWorkspaceProps} items={[{ ...item, name: riskTypeName }]} />);
    bounded(within(screen.getByRole('table', { name: 'Risk Types results' })).getByRole('link', { name: riskTypeName }));
    riskTypesView.unmount();

    const systemName = long('Customer portal and partner gateway', 255);
    const ownerName = long('Jane Doe of the Enterprise Platforms Group', 255);
    const criticality = long('High for payments and customer onboarding', 255);
    const systemsView = render(<AdministrationWorkspace
      {...baseWorkspaceProps}
      kind="information-systems"
      items={[{ documentId: 'system-1', name: systemName, description: null, systemType: 'Web application', owner: 'user-1', ownerName, businessCriticality: criticality, environment: 'Production', deploymentModel: 'Cloud', lifecycleState: 'Existing', internetFacing: true }]}
    />);
    const systemsTable = screen.getByRole('table', { name: 'Information Systems results' });
    bounded(within(systemsTable).getByRole('link', { name: systemName }));
    bounded(within(systemsTable).getByText(ownerName, { exact: true }));
    bounded(within(systemsTable).getByText(criticality, { exact: true }));
    // Short values stay on one line in a compact column: no 14rem minimum is imposed on the cell.
    expect(within(systemsTable).getByText('Production', { exact: true }).closest('td')).not.toHaveClass('whitespace-normal');
    expect(within(systemsTable).getByText(ownerName, { exact: true }).closest('td')).not.toHaveClass('min-w-56');
    systemsView.unmount();

    const assetName = long('Customer identity records', 255);
    const location = long('Sydney primary data centre, rack 14, cage B', 500);
    render(<AdministrationWorkspace
      {...baseWorkspaceProps}
      kind="information-assets"
      items={[{ documentId: 'asset-1', name: assetName, description: null, type: 'Dataset', dataClassification: 'Restricted', location, containsPersonalData: true, containsLegalData: false, containsCreditCardData: false } as AdministrationItem & { location: string }]}
    />);
    const assetsTable = screen.getByRole('table', { name: 'Information Assets results' });
    bounded(within(assetsTable).getByRole('link', { name: assetName }));
    bounded(within(assetsTable).getByText(location, { exact: true }));
  });

  /*
   * WR-04: a missing required field is asked for by its label in the product's words, never in a validation
   * library's default English, and an optional field holding only spaces is empty rather than an error.
   */
  it('asks for each missing Control field in words and submits spaces-only optional text as empty', async () => {
    const user = userEvent.setup();
    const { AdministrationForm } = await loadWorkspace();
    const createAction = vi.fn().mockResolvedValue({ ok: true, data: { documentId: 'control-3', controlNumber: 'AC-3', name: 'Access Enforcement' } });
    render(<AdministrationForm kind="controls" mode="create" createAction={createAction} />);

    await user.click(screen.getByRole('button', { name: 'Create Control' }));
    expect(await screen.findByText('Enter a control number.')).toBeInTheDocument();
    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a framework.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Too small|Too big|Invalid input|expected string/);
    expect(createAction).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: 'Control number' }), 'AC-3');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Access Enforcement');
    await user.type(screen.getByRole('textbox', { name: /^Framework$/ }), 'NIST SP 800-53');
    for (const label of ['Framework version', 'Control reference', 'Framework source']) {
      await user.type(screen.getByRole('textbox', { name: label }), '   ');
    }
    await user.click(screen.getByRole('button', { name: 'Create Control' }));

    expect(createAction).toHaveBeenCalledWith({ values: expect.objectContaining({
      controlNumber: 'AC-3', name: 'Access Enforcement', framework: 'NIST SP 800-53',
      controlReference: null, frameworkVersion: null, frameworkSource: null,
    }) });
    expect(document.body.textContent).not.toMatch(/leave it empty|Too small/);
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

  it('UAT-053 seeds the Information System owner with the served name and never the id', async () => {
    const { AdministrationForm } = await loadWorkspace();
    const record = { name: 'Customer portal', description: null, owner: 'owner-document-id-1', businessCriticality: 'High' };
    const named = render(<AdministrationForm kind="information-systems" mode="edit" documentId="system-1" initialValues={{ ...record, ownerName: 'Jane Doe' }} updateAction={vi.fn()} />);
    expect(screen.getByText('Selected owner: Jane Doe')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('owner-document-id-1');
    named.unmount();

    render(<AdministrationForm kind="information-systems" mode="edit" documentId="system-1" initialValues={{ ...record, ownerName: null }} updateAction={vi.fn()} />);
    expect(screen.getByText('Selected owner: Name not available')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('owner-document-id-1');
  });

  it('UAT-053 lists each Information System owner and business criticality after Name, unsortable, on desktop and mobile', async () => {
    const { AdministrationWorkspace } = await loadWorkspace();
    const base = { description: null, systemType: 'Web application', environment: 'Production' as const, deploymentModel: 'Cloud' as const, lifecycleState: 'Existing' as const, internetFacing: true };
    const systems = [
      { ...base, documentId: 'system-named', name: 'Customer portal', owner: 'owner-document-id-1', ownerName: 'Jane Doe', businessCriticality: 'High' },
      { ...base, documentId: 'system-unnamed', name: 'Billing engine', owner: 'owner-document-id-2', ownerName: null, businessCriticality: null },
      { ...base, documentId: 'system-unowned', name: 'Data lake', owner: null, ownerName: null, businessCriticality: 'Medium' },
    ];
    render(<AdministrationWorkspace {...baseWorkspaceProps} kind="information-systems" items={systems} pagination={{ page: 1, pageSize: 25, pageCount: 1, total: 3 }} />);

    const table = screen.getByRole('table', { name: 'Information Systems results' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Name', 'Owner', 'Business criticality', 'Type', 'Environment', 'Deployment model', 'Lifecycle', 'Internet-facing',
    ]);
    expect(within(table).getByRole('button', { name: 'Sort by Name' })).toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Sort by Owner' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Sort by Business criticality' })).not.toBeInTheDocument();

    const cellsOf = (name: string) => within(within(table).getByRole('row', { name: new RegExp(name) })).getAllByRole('cell').map((cell) => cell.textContent);
    expect(cellsOf('Customer portal').slice(0, 3)).toEqual(['Customer portal', 'Jane Doe', 'High']);
    expect(cellsOf('Billing engine').slice(0, 3)).toEqual(['Billing engine', 'Name not available', 'Not provided']);
    expect(cellsOf('Data lake').slice(0, 3)).toEqual(['Data lake', 'Not provided', 'Medium']);

    const cards = screen.getByRole('list', { name: 'Information Systems results' });
    expect(within(cards).getByText('Owner: Jane Doe · Business criticality: High')).toBeInTheDocument();
    expect(within(cards).getByText('Owner: Name not available · Business criticality: Not provided')).toBeInTheDocument();
    expect(within(cards).getByText('Owner: Not provided · Business criticality: Medium')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/owner-document-id/);
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
    // The denial keeps the page's one level-one heading, naming the collection that refused (STATE follow-up 2026-09-25).
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Risk Types');
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.queryByText(/result/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create|import/i })).not.toBeInTheDocument();
  });

  it.each([
    ['risk-types', 'Risk Types'],
    ['controls', 'Controls'],
    ['information-systems', 'Information Systems'],
    ['information-assets', 'Information Assets'],
    [undefined, 'Administration'],
  ] as const)('names the refused page, %s, in the denial’s one level-one heading above the permission state', async (kind, heading) => {
    const { AdministrationAccessDenied } = await loadWorkspace();
    render(<AdministrationAccessDenied kind={kind} />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(heading);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('You don’t have access to Administration records');
    expect(alert).toHaveAttribute('data-state-kind', 'permission');
    // The heading comes first, so the permission state reads as the page's content, not its title.
    expect(headings[0]!.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/app');
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

  it('names boolean fieldsets and exposes Applicable controls combobox state', async () => {
    const { AdministrationForm } = await loadWorkspace();
    const view = render(<AdministrationForm kind="information-systems" mode="create" createAction={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Internet-facing' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'External access required' })).toBeInTheDocument();
    view.unmount();
    render(<AdministrationForm kind="risk-types" mode="create" createAction={vi.fn()} initialControlOptions={[{ documentId: 'control-1', label: 'AC-1 · Access control' }]} />);
    const combobox = screen.getByRole('combobox', { name: 'Applicable controls' });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    expect(combobox).toHaveAttribute('aria-controls', 'applicable-control-options');
    expect(screen.getByRole('status')).toHaveTextContent('1 control options available.');
  });

  it('labels the applicable controls field in sentence case, since control is not a capitalised record term (UI-SPEC Voice)', async () => {
    const { AdministrationForm } = await loadWorkspace();
    render(<AdministrationForm kind="risk-types" mode="create" createAction={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Applicable controls' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Applicable controls' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search controls' })).toBeInTheDocument();
    const selected = screen.getByRole('group', { name: 'Selected applicable controls' });
    expect(within(selected).getByText('No applicable controls selected.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Applicable Controls|Search Controls|applicable Controls/);
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

  /*
   * D-36 (UI-SPEC §16.2): a saved applicable control reads by its control label, never its id. The page supplies
   * the labels of saved selections beyond the first 100 options; a selection with no known label reads
   * `Control not found`.
   */
  it('UAT-007 labels each saved applicable control and never shows its id', async () => {
    // Each selection renders a checkbox, which measures itself.
    installTestResizeObserver();
    onTestFinished(() => { vi.unstubAllGlobals(); });
    const { AdministrationForm } = await loadWorkspace();
    render(<AdministrationForm
      documentId={item.documentId}
      initialControlOptions={[
        { documentId: 'control-near', label: '5.1' },
        { documentId: 'control-far', label: 'V3.1.1 · Verify session management' },
      ]}
      initialValues={{ ...item, applicableControls: ['control-far', 'control-missing'] }}
      kind="risk-types"
      mode="edit"
      updateAction={vi.fn()}
    />);

    const selected = screen.getByRole('group', { name: 'Selected applicable controls' });
    expect(within(selected).getByText('V3.1.1 · Verify session management')).toBeInTheDocument();
    expect(within(selected).getByText('Control not found')).toBeInTheDocument();
    expect(selected.textContent).not.toMatch(/control-far|control-missing/);
  });

  it('offers the first 100 controls by number and adds each saved selection beyond them, by its control label', () => {
    const controls = Array.from({ length: 150 }, (_, index) => ({
      documentId: `control-${index}`, controlNumber: `C-${index}`, name: `C-${index} — Control ${index}`, description: null,
    })).reverse();

    const options = applicableControlOptions(controls, ['control-140', 'control-2', 'control-unknown']);
    expect(options).toHaveLength(101);
    expect(options[0]).toEqual({ documentId: 'control-0', label: 'C-0 · Control 0' });
    expect(options[99]).toEqual({ documentId: 'control-99', label: 'C-99 · Control 99' });
    expect(options[100]).toEqual({ documentId: 'control-140', label: 'C-140 · Control 140' });
    expect(applicableControlOptions([{ documentId: 'control-5-1', controlNumber: '5.1', name: '5.1' }]))
      .toEqual([{ documentId: 'control-5-1', label: '5.1' }]);
    expect(applicableControlOptions([], ['control-1'])).toEqual([]);
  });

  /* D-38 (UI-SPEC §17.1): Administration copy says what each page is for, never how the system stores it. */
  it.each([
    ['risk-types', 'Manage the Risk Types used to identify Risks in assessments.'],
    ['controls', 'Manage the control library used for mitigation controls on Risks.'],
  ] as const)('UAT-054 describes the %s collection plainly', async (kind, description) => {
    const { AdministrationWorkspace } = await loadWorkspace();
    render(<AdministrationWorkspace {...baseWorkspaceProps} kind={kind} items={[]} state="empty" pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} />);
    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it('UAT-054 explains each Administration form in plain words', async () => {
    installTestResizeObserver();
    onTestFinished(() => { vi.unstubAllGlobals(); });
    const { AdministrationForm } = await loadWorkspace();
    const plainText = () => expect(document.body.textContent).not.toMatch(/reusable|contextual|canonical|non-editable|Strapi/i);

    const controlCreate = render(<AdministrationForm kind="controls" mode="create" createAction={vi.fn()} />);
    for (const text of [
      'Add a control to the library.', 'Identify this control and the framework it comes from.',
      'Enter the control’s title without its number.', 'Describe what this control requires.',
    ]) expect(screen.getByText(text)).toBeInTheDocument();
    plainText();
    controlCreate.unmount();

    const control = { name: 'APP-11 — Security of personal information', description: null, controlNumber: 'APP-11', framework: 'Privacy Act 1988' };
    const controlEdit = render(<AdministrationForm kind="controls" mode="edit" documentId="control-1" initialValues={control} updateAction={vi.fn()} />);
    for (const text of [
      'Edit this control. Mitigation controls on Risks keep their own status and evidence.',
      'Mitigation controls on Risks keep their own assessment history.',
      'This control may be used by Risk Types and by mitigation controls on Risks. Nothing is deleted or changed automatically.',
    ]) expect(screen.getByText(text)).toBeInTheDocument();
    plainText();
    controlEdit.unmount();

    const riskTypeCreate = render(<AdministrationForm kind="risk-types" mode="create" createAction={vi.fn()} />);
    for (const text of [
      'Create a Risk Type for use in future assessments.', 'Name and describe this Risk Type.',
      'Explain which risks this Risk Type covers.', 'Choose the controls that usually mitigate this Risk Type.',
      'Search by control number, name or framework.',
    ]) expect(screen.getByText(text)).toBeInTheDocument();
    plainText();
    riskTypeCreate.unmount();

    // The stored description is data, so this fixture's own words stay clear of the terms checked above.
    const riskTypeEdit = render(<AdministrationForm kind="risk-types" mode="edit" documentId={item.documentId} initialValues={{ name: item.name, description: 'Misuse of valid credentials', applicableControls: [] }} updateAction={vi.fn()} />);
    for (const text of [
      'Edit this Risk Type. Risks already identified keep their own details.',
      'Risks already identified keep their own assessment history.',
      'Applicable controls suggest controls for this Risk Type only. Nothing is deleted or changed automatically.',
    ]) expect(screen.getByText(text)).toBeInTheDocument();
    plainText();
    riskTypeEdit.unmount();

    render(<AdministrationForm kind="information-systems" mode="edit" documentId="system-1" initialValues={{ name: 'Customer portal', description: null }} updateAction={vi.fn()} />);
    expect(screen.getByText('Assessments and Risks keep their own history.')).toBeInTheDocument();
    expect(screen.getByText('This Information System may be used in assessments. Nothing is deleted or changed automatically.')).toBeInTheDocument();
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

/** The element that scrolls a CSV import table: the region wrapper, never the table primitive's own container. */
function scrollerOf(table: HTMLElement) {
  return table.closest<HTMLElement>('[data-overflow]')!;
}

describe('ADMIN-04 five-step CSV import workflow', () => {
  beforeEach(() => {
    installTestResizeObserver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
      // 19-15 (19-UI-SPEC §5.1, §10): the title names no format, since a workbook imports too.
      expect(screen.getByRole('heading', { level: 1, name: `Import ${candidate.label}` })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: candidate.column })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: `Return to ${candidate.label}` })).toHaveAttribute('href', candidate.listPath);
      // The heading names the collection, so the template pills stay short enough for 375px (UI-SPEC section 11 addendum).
      expect(screen.getByRole('button', { name: 'Download CSV template' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download Excel template' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Download .+ (CSV|Excel) template/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Choose file' })).toBeInTheDocument();
      view.unmount();
    }
  });

  it('scrolls the Guidance columns table in one wrapper that is a labelled, focusable region only while it overflows', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    render(<CsvImportFlow kind="risk-types" previewAction={vi.fn()} commitAction={vi.fn()} />);

    const table = screen.getByRole('table', { name: 'Risk Type columns in the file' });
    const scroller = scrollerOf(table);
    const container = table.closest('[data-slot="table-container"]')!;
    expect(scroller).not.toBe(container);
    expect(scroller).toHaveClass('overflow-x-auto', 'rounded-lg', 'border', '[&>[data-slot=table-container]]:overflow-visible');

    expect(scroller).toHaveAttribute('data-overflow', 'false');
    for (const attribute of ['role', 'aria-label', 'tabindex']) expect(scroller).not.toHaveAttribute(attribute);

    // The 343px column at 375: the column guidance is wider than its wrapper.
    stubHorizontalGeometry(scroller, { scrollWidth: 480, clientWidth: 311 });
    act(() => TestResizeObserver.notifyAll());

    expect(screen.getByRole('region', { name: 'Risk Type columns in the file, scrolls horizontally' })).toBe(scroller);
    expect(scroller).toHaveAttribute('tabindex', '0');
    expect(scroller).toHaveAttribute('data-overflow', 'true');
    for (const attribute of ['role', 'tabindex']) expect(container).not.toHaveAttribute(attribute);
  });

  /*
   * 19-UI-SPEC review amendment R2: the import takes CSV and Excel, so its words name the file, not CSV, and a step not
   * yet reached is announced by its state.
   */
  it('names the columns and rows by the file, and announces a step not yet reached as Not started (R2)', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const { container, unmount } = render(<CsvImportFlow kind="risk-types" previewAction={vi.fn()} commitAction={vi.fn()} />);
    expect(screen.getByRole('table', { name: 'Risk Type columns in the file' })).toBeInTheDocument();
    const steps = within(screen.getByRole('list', { name: 'Import progress' })).getAllByRole('listitem');
    expect(steps.slice(1).map((step) => step.querySelector('.sr-only')?.textContent)).toEqual(['Not started', 'Not started', 'Not started', 'Not started']);
    expect(container.textContent).not.toMatch(/Future step|CSV columns/);
    unmount();

    await renderPreview(CsvImportFlow, [{ rowNumber: 2, naturalKey: 'Created row', state: 'create', issues: [] }]);
    const preview = screen.getByRole('table', { name: 'Risk Type import preview' });
    expect(within(preview).getAllByRole('columnheader')[0]).toHaveTextContent(/^File row$/);
    expect(screen.getByText('File row 2')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/CSV row/);
  });

  it('leaves focus with the page on first render and moves it to the step heading only on a step change', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const user = userEvent.setup();
    render(<CsvImportFlow kind="risk-types" previewAction={vi.fn()} commitAction={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Guidance' })).not.toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Choose file' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Select file' })).toHaveFocus();
  });

  /* D-38 (UI-SPEC §17.1): the import explains matching by the collection's own column and never names the server. */
  it('UAT-054 explains matching, the final check and the key column in plain words', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const controls = render(<CsvImportFlow kind="controls" previewAction={vi.fn()} commitAction={vi.fn()} />);
    // 19-UI-SPEC §5.3: Phase 10's sentence, with the row that waits for a choice.
    expect(screen.getByText('A row whose control number matches an existing control updates it. Other valid rows create new controls. A row whose name matches an existing one only by capitals or spacing waits for your choice. Unchanged, rejected and ambiguous rows are never written.')).toBeInTheDocument();
    controls.unmount();

    const rows: CsvPreviewRow[] = [{ rowNumber: 2, naturalKey: 'Create', state: 'create', issues: [] }];
    const { user } = await renderPreview(CsvImportFlow, rows);
    expect(within(screen.getByRole('table', { name: 'Risk Type import preview' })).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    expect(screen.getByText('Imports never delete records. We check the file again before anything is written.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Strapi|natural key|natural-key|authoritative|Server validation/i);
  });

  it('UAT-054 asks to choose the file again when the preview can’t be loaded', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const user = userEvent.setup();
    render(<CsvImportFlow kind="risk-types" previewAction={vi.fn().mockResolvedValue({ unexpected: true })} commitAction={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Choose file' }));
    await user.upload(screen.getByLabelText('File to import', { selector: 'input' }), new File(['name\r\nExample'], 'risk-types.csv', { type: 'text/csv' }));
    await user.click(screen.getByRole('button', { name: 'Validate and preview' }));
    expect(await screen.findByText('The preview couldn’t be loaded. Choose the file again to retry.', { selector: '#csv-file-error' })).toBeInTheDocument();
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
    // WR-08: each row state is a status badge from the shared mapping, in the direction's tone vocabulary.
    const tones = { Create: 'success', Update: 'success', Unchanged: 'neutral', Rejected: 'warning', Ambiguous: 'warning' } as const;
    for (const [state, tone] of Object.entries(tones)) {
      const badge = within(screen.getByRole('row', { name: new RegExp(state, 'i') })).getByText(state, { exact: true, selector: '[data-slot="badge"]' });
      expect(badge, state).toHaveAttribute('data-tone', tone);
      expect(badge.querySelectorAll('svg'), state).toHaveLength(1);
    }
    // An ambiguous row is never shown with the High severity triangle.
    expect(document.querySelector('[data-slot="badge"] .lucide-triangle-alert')).toBeNull();
  });

  it('paginates preview rows at 100 and exposes the mobile card presentation', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const rows = Array.from({ length: 101 }, (_, index): CsvPreviewRow => ({ rowNumber: index + 2, naturalKey: `Row ${index}`, state: 'create', issues: [] }));
    const { user } = await renderPreview(CsvImportFlow, rows);
    const previewScroller = scrollerOf(screen.getByRole('table', { name: 'Risk Type import preview' }));
    expect(previewScroller).toHaveClass('hidden', 'md:grid', '[&>[data-slot=table-container]]:overflow-visible');
    expect(previewScroller).toHaveAttribute('data-overflow', 'false');
    expect(screen.getByRole('table', { name: 'Risk Type import preview' }).querySelectorAll('tbody tr')).toHaveLength(100);
    expect(document.querySelectorAll('[data-slot="csv-import-mobile"] article')).toHaveLength(100);
    await user.click(screen.getByRole('button', { name: 'Next rows' }));
    expect(screen.getByRole('table', { name: 'Risk Type import preview' }).querySelectorAll('tbody tr')).toHaveLength(1);
  });

  /* 19-15 (D-25; 19-UI-SPEC §5.4): the browser checks the extension and the 5 MB size, and words a refusal with S2. */
  it('rejects file bounds before preview service invocation', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { CsvImportFlow } = await loadImportFlow();
    const previewAction = vi.fn();
    render(<CsvImportFlow kind="risk-types" previewAction={previewAction} commitAction={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Choose file' }));
    const file = new File([new Uint8Array(5_242_881)], 'too-large.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('File to import', { selector: 'input' }), file);
    await user.click(screen.getByRole('button', { name: 'Validate and preview' }));
    const refusal = await screen.findByRole('alert');
    expect(refusal).toHaveTextContent('This file is too large');
    expect(refusal).toHaveTextContent('“too-large.csv” is 5.1 MB. The limit is 5 MB. Split the rows into smaller files and import each.');

    await user.upload(screen.getByLabelText('File to import', { selector: 'input' }), new File(['x'], 'legacy.xls', { type: 'application/vnd.ms-excel' }));
    await user.click(screen.getByRole('button', { name: 'Validate and preview' }));
    const typeRefusal = await screen.findByRole('alert');
    expect(typeRefusal).toHaveTextContent('Choose a CSV or Excel file');
    expect(typeRefusal).toHaveTextContent('“legacy.xls” isn’t a CSV or Excel workbook (.xlsx).');
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
    await user.click(screen.getByRole('checkbox', { name: 'I have reviewed the rows to create and update.' }));
    await user.click(confirm);
    expect(commitAction).toHaveBeenCalledTimes(1);
    const submitted = commitAction.mock.calls[0]?.[0] as FormData;
    expect(submitted.get('confirmed')).toBe('true');
    expect(submitted.get('previewDigest')).toBe(`sha256:${'1'.repeat(64)}`);

    const resultsScroller = scrollerOf(await screen.findByRole('table', { name: 'Risk Type import results' }));
    expect(resultsScroller).toHaveClass('hidden', 'md:grid', '[&>[data-slot=table-container]]:overflow-visible');
    expect(resultsScroller).toHaveAttribute('data-overflow', 'false');
  });

  /* 19-13 (19-UI-SPEC §5.6, UI-D16, X-32): a similar row's badge comes from the import-only map, with its own label. */
  it('shows a row matched by similar name with its own badge, and counts it among the states', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    await renderPreview(CsvImportFlow, [
      { rowNumber: 2, naturalKey: 'credential misuse', state: 'similar', issues: [] },
      { rowNumber: 3, naturalKey: 'Create', state: 'create', issues: [] },
    ]);
    const table = screen.getByRole('table', { name: 'Risk Type import preview' });
    const similarBadge = within(table).getByText('Matched by similar name').closest('[data-tone]');
    expect(similarBadge).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByRole('button', { name: 'Matched by similar name (1)' })).toBeInTheDocument();
  });

  it('traverses backward and forward with focus, live status, authoritative results, and no automatic retry', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const commitAction = vi.fn().mockResolvedValue({ ok: true, data: {
      fileName: 'risk-types.csv', previewDigest: `sha256:${'1'.repeat(64)}`, limits: { maxBytes: 5_242_880, maxRows: 5_000 },
      summary: { create: 1, update: 1, unchanged: 1, rejected: 1, ambiguous: 1, skipped: 0 },
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
    await second.user.click(screen.getByRole('checkbox', { name: 'I have reviewed the rows to create and update.' }));
    await second.user.click(screen.getByRole('button', { name: 'Confirm import' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Import completed with rejected rows' })).toHaveFocus();
    for (const text of ['Created 1', 'Updated 1', 'Unchanged 1', 'Rejected 1', 'Ambiguous 1']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByText('The final check changed some results')).toBeInTheDocument();
    expect(screen.getByText(/The final check before import changed the result for 1 row/)).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Risk Type import results' })).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Risk Types' })).toHaveAttribute('href', '/app/admin/risk-types');
    expect(commitAction).toHaveBeenCalledTimes(1);
  });
});

/*
 * Phase 19 (19-15 Task 1; D-25, D-27, D-31; 19-UI-SPEC §5.1 to §5.5): the import reads nothing in the browser, offers
 * Strapi's two templates, and shows the preview's ignored columns and notes.
 */
describe('CSV-02 the import reads files through Strapi alone', () => {
  const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  beforeEach(() => {
    installTestResizeObserver();
    importMocks.saveFile.mockReset();
    importMocks.toastSuccess.mockReset();
  });

  it('titles the Information Systems import, explains its columns and how values are read, and offers both templates, Excel first', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    render(<CsvImportFlow kind="information-systems" previewAction={vi.fn()} commitAction={vi.fn()} templateAction={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Import Information Systems' })).toBeInTheDocument();
    expect(screen.getByText('Import a CSV or Excel file. You review every row before anything is created or updated.')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Information System columns in the file' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Column', 'Also accepted as', 'Required', 'Format and allowed values']);
    const internetFacing = within(table).getByRole('row', { name: /Internet-facing/ });
    expect(within(internetFacing).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Internet-facing', 'internetFacing', 'Optional', 'Yes or No']);
    expect(within(within(table).getByRole('row', { name: /^Name/ })).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Name', 'name', 'Required', 'Text, up to 255 characters']);

    const rules = screen.getByRole('list', { name: 'How values are read' });
    expect(within(rules).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Headers match whatever their capitals and spacing, by the column name or the name in the template.',
      'Yes/No columns accept Yes, No, Y, N, TRUE or FALSE.',
      'A blank cell leaves an existing value unchanged. To empty an optional value, type #CLEAR.',
      'Columns that aren’t listed here are ignored, and you’ll see which.',
      'If you edit in Excel, use the Excel template or an Excel export: Excel removes leading zeros (0042) and changes date-like text when it opens a CSV.',
    ]);

    const actions = screen.getAllByRole('button').map((button) => button.textContent);
    expect(actions.indexOf('Download Excel template')).toBeLessThan(actions.indexOf('Download CSV template'));
    expect(actions.indexOf('Choose file')).toBeLessThan(actions.indexOf('Download Excel template'));
  });

  it('saves the Excel template Strapi serves and names it in the toast', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const user = userEvent.setup();
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    let finish: (value: unknown) => void = () => undefined;
    const templateAction = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    render(<CsvImportFlow kind="information-systems" previewAction={vi.fn()} commitAction={vi.fn()} templateAction={templateAction} />);

    await user.click(screen.getByRole('button', { name: 'Download Excel template' }));
    expect(templateAction).toHaveBeenCalledWith({ kind: 'information-systems', format: 'xlsx' });
    expect(screen.getByRole('button', { name: 'Downloading…' })).toHaveAttribute('aria-disabled', 'true');
    await act(async () => finish({ ok: true, fileName: 'information-systems-import-template.xlsx', contentType: XLSX_TYPE, bytes }));

    expect(importMocks.saveFile).toHaveBeenCalledWith({ fileName: 'information-systems-import-template.xlsx', contentType: XLSX_TYPE, bytes });
    expect(importMocks.toastSuccess).toHaveBeenCalledWith('Downloaded information-systems-import-template.xlsx', expect.objectContaining({ duration: 5_000 }));
    expect(screen.getByRole('button', { name: 'Download Excel template' })).toBeEnabled();
  });

  it('keeps a refused template download on the Guidance step with S3’s copy and Try again', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const user = userEvent.setup();
    const templateAction = vi.fn()
      .mockResolvedValueOnce({ ok: false, refusal: { message: 'We couldn’t download the template.', action: 'Try again' } })
      .mockResolvedValueOnce({ ok: true, fileName: 'risk-types-import-template.csv', contentType: 'text/csv; charset=utf-8', bytes: new Uint8Array([0xef, 0xbb, 0xbf]) });
    render(<CsvImportFlow kind="risk-types" previewAction={vi.fn()} commitAction={vi.fn()} templateAction={templateAction} />);

    await user.click(screen.getByRole('button', { name: 'Download CSV template' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t download the template.');
    expect(importMocks.saveFile).not.toHaveBeenCalled();
    expect(importMocks.toastSuccess).not.toHaveBeenCalled();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(templateAction).toHaveBeenLastCalledWith({ kind: 'risk-types', format: 'csv' });
    expect(importMocks.saveFile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('We couldn’t download the template.')).not.toBeInTheDocument();
    // FE4-04 (WCAG 2.4.3): Try again removes itself, so focus moves to the template it retried, never to the page body.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download CSV template' })).toHaveFocus());
  });

  it('moves focus to the template button when a retried template is refused again (FE4-04)', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const user = userEvent.setup();
    const refused = { ok: false, refusal: { message: 'We couldn’t download the template.', action: 'Try again' } };
    const templateAction = vi.fn().mockResolvedValue(refused);
    render(<CsvImportFlow kind="risk-types" previewAction={vi.fn()} commitAction={vi.fn()} templateAction={templateAction} />);

    await user.click(screen.getByRole('button', { name: 'Download Excel template' }));
    await user.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Try again' }));

    expect(templateAction).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t download the template.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download Excel template' })).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
  });

  it('uploads an .xlsx after checking only its extension and size, and shows the columns Strapi will ignore', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    const user = userEvent.setup();
    const read = { arrayBuffer: vi.fn(), text: vi.fn(), stream: vi.fn() };
    const workbook = Object.assign(new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'risk-types.xlsx', { type: XLSX_TYPE }), read);
    const readAsArrayBuffer = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer');
    const readAsText = vi.spyOn(FileReader.prototype, 'readAsText');
    onTestFinished(() => { readAsArrayBuffer.mockRestore(); readAsText.mockRestore(); });
    const previewAction = vi.fn().mockResolvedValue({ ok: true, data: { ...previewData([{ rowNumber: 2, naturalKey: 'Credential misuse', state: 'create', issues: [] }]), fileName: 'risk-types.xlsx', warnings: ['Owner', 'Notes column'] } });
    render(<CsvImportFlow kind="risk-types" previewAction={previewAction} commitAction={vi.fn()} templateAction={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Choose file' }));
    const input = screen.getByLabelText('File to import', { selector: 'input' });
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', '.csv,.xlsx');
    expect(input).not.toHaveAttribute('multiple');
    expect(screen.getByText('A CSV (UTF-8) or Excel workbook (.xlsx), up to 5 MB and 5,000 rows.')).toBeInTheDocument();
    await user.upload(input, workbook);
    expect(screen.getByText('risk-types.xlsx · 4 bytes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Validate and preview' }));
    await screen.findByRole('heading', { level: 2, name: 'Review rows' });

    const sent = previewAction.mock.calls[0]?.[0] as FormData;
    expect(sent.get('kind')).toBe('risk-types');
    expect((sent.get('file') as File).name).toBe('risk-types.xlsx');
    for (const method of Object.values(read)) expect(method).not.toHaveBeenCalled();
    expect(readAsArrayBuffer).not.toHaveBeenCalled();
    expect(readAsText).not.toHaveBeenCalled();

    const ignored = screen.getByText('Some columns will be ignored').closest('[data-slot="alert"]')!;
    expect(ignored).toHaveTextContent('These columns aren’t part of the Risk Type import: “Owner”, “Notes column”. Their values won’t be imported.');
  });

  it('names each note the preview carries, in its own line', async () => {
    const { CsvImportFlow } = await loadImportFlow();
    await renderPreview(CsvImportFlow, [{ rowNumber: 3, naturalKey: 'Credential misuse', state: 'create', issues: [] }], vi.fn(), {
      notes: ['issues-column', 'read-only-columns', 'example-row'],
      readOnlyColumns: ['Applicable controls'],
    });
    for (const line of [
      'The Issues column from an error report is ignored.',
      'Columns from a Risk Types export that can’t be imported are ignored: Applicable controls.',
      'Row 2 is the template’s example row, so it’s skipped.',
    ]) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(screen.queryByText('Some columns will be ignored')).not.toBeInTheDocument();
  });
});

/*
 * Phase 19 (19-15 Task 2; D-26, D-30, D-32; X-32, X-14; 19-UI-SPEC §5.4 to §5.8, §6 S2 and S3, §7): a file Strapi can't
 * read says how to fix it, a near-match name waits for the Security Analyst's own choice, and the rows that weren't
 * imported come back as a file to correct.
 */
describe('CSV-03 file refusals, near-match decisions and error reports in the import flow', () => {
  const STORED = 'UAT-B: Core customer billing system';
  const ISSUES_NAME = 'risk-types-import-issues-2026-10-17.csv';

  beforeEach(() => {
    installTestResizeObserver();
    importMocks.saveFile.mockReset();
    importMocks.toastSuccess.mockReset();
    importMocks.toastDismiss.mockReset();
  });

  /** A preview with one create row and two rows matched by similar name to stored records. */
  function similarPreview() {
    const data = previewData([
      { rowNumber: 2, naturalKey: 'New risk', state: 'create', issues: [] },
      { rowNumber: 3, naturalKey: 'uat-b: core customer billing system', state: 'similar', issues: [] },
      { rowNumber: 4, naturalKey: 'UAT-B:  Core customer billing  platform', state: 'similar', issues: [] },
    ]);
    return { ...data, rows: data.rows.map((row) => (row.state === 'similar' ? { ...row, matchedName: row.rowNumber === 3 ? STORED : 'UAT-B: Core customer billing platform' } : row)) };
  }

  async function renderSimilar(commitAction = vi.fn(), errorReportAction = vi.fn()) {
    const preview = similarPreview();
    const rendered = await renderPreview(loadedFlow!, [], commitAction, preview, { errorReportAction });
    return { ...rendered, preview };
  }

  let loadedFlow: ImportModule['CsvImportFlow'] | null = null;
  beforeEach(async () => {
    loadedFlow = (await loadImportFlow()).CsvImportFlow;
  });

  const previewTable = () => screen.getByRole('table', { name: 'Risk Type import preview' });
  const decisionGroup = (rowNumber: number) => within(previewTable()).getByRole('radiogroup', { name: `Decision for row ${rowNumber}` });

  it('S2 shows a file Strapi refused as a warning alert with its numbered steps, keeps the file and focuses the title', async () => {
    const user = userEvent.setup();
    const steps = [
      '1. In Excel, choose File > Save As.',
      '2. Choose “CSV UTF-8 (Comma delimited) (*.csv)” and save.',
      '3. Choose the new file here. Or upload the Excel workbook (.xlsx) itself.',
    ];
    const previewAction = vi.fn().mockResolvedValue({
      ok: false,
      formError: 'Save the file as CSV UTF-8',
      refusal: { family: 'file', reason: 'IMPORT_ENCODING_WINDOWS_1252', title: 'Save the file as CSV UTF-8', body: 'This file is in Excel’s older “CSV (Comma delimited)” format, which can garble names with accents or symbols.', steps },
    });
    const Flow = loadedFlow!;
    render(<Flow kind="risk-types" previewAction={previewAction} commitAction={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Choose file' }));
    await user.upload(screen.getByLabelText('File to import', { selector: 'input' }), new File([Buffer.from('Name\r\nCafé', 'latin1')], 'excel.csv', { type: 'text/csv' }));
    await user.click(screen.getByRole('button', { name: 'Validate and preview' }));

    const title = await screen.findByText('Save the file as CSV UTF-8');
    expect(title).toHaveFocus();
    const alert = title.closest('[data-slot="alert"]') as HTMLElement;
    expect(alert).toHaveClass('bg-warning-subtle');
    // FE4-03 (accessibility contract 4.1.3): focus moves to the refusal, so it is not also a live region; it is read once.
    expect(alert).not.toHaveAttribute('role');
    expect(alert.closest('[aria-live], [role="alert"], [role="status"]')).toBeNull();
    expect(alert).toHaveTextContent('This file is in Excel’s older “CSV (Comma delimited)” format, which can garble names with accents or symbols.');
    expect(within(alert).getAllByRole('listitem').map((item) => item.textContent)).toEqual(steps);
    // The alert sits above the field, and the chosen file stays listed.
    expect(alert.compareDocumentPosition(screen.getByLabelText('File to import', { selector: 'input' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('excel.csv · 10 bytes')).toBeInTheDocument();
    const open = vi.spyOn(screen.getByLabelText('File to import', { selector: 'input' }) as HTMLInputElement, 'click');
    await user.click(within(alert).getByRole('button', { name: 'Choose another file' }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Select file' })).toBeInTheDocument();
  });

  /* FE4-11: a commit whose result can't be read is an unknown outcome, said once; no message is thrown and dropped. */
  it.each([
    ['a result it can’t read', () => vi.fn().mockResolvedValue({ ok: true })],
    ['a failure reaching it', () => vi.fn().mockRejectedValue(new Error('network'))],
  ])('says the import outcome is unknown after %s', async (_case, commit) => {
    const { user } = await renderPreview(loadedFlow!, [{ rowNumber: 2, naturalKey: 'Create', state: 'create', issues: [] }], commit());
    await user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    await user.click(screen.getByRole('checkbox', { name: 'I have reviewed the rows to create and update.' }));
    await user.click(screen.getByRole('button', { name: 'Confirm import' }));

    const alert = (await screen.findByText('Import outcome unknown')).closest('[data-slot="alert"]') as HTMLElement;
    expect(alert).toHaveTextContent('We couldn’t confirm whether the import completed. Check the collection before trying again.');
    expect(within(alert).getByRole('link', { name: 'View Risk Types' })).toBeInTheDocument();
    const source = readFileSync(resolve(process.cwd(), 'src/features/administration/csv-import-flow.tsx'), 'utf8');
    expect(source).not.toContain('The selected file is unavailable.');
    expect(source).not.toContain('The import result couldn’t be loaded');
  });

  it('S3 says an expired review must be checked again and offers Choose file again', async () => {
    const commitAction = vi.fn().mockResolvedValue({
      ok: false,
      formError: 'This review has expired. Choose the file again to check it.',
      refusal: { family: 'step', step: 'review-expired', message: 'This review has expired. Choose the file again to check it.', action: 'Choose file again' },
    });
    const { user } = await renderPreview(loadedFlow!, [{ rowNumber: 2, naturalKey: 'Create', state: 'create', issues: [] }], commitAction);
    await user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    await user.click(screen.getByRole('checkbox', { name: 'I have reviewed the rows to create and update.' }));
    await user.click(screen.getByRole('button', { name: 'Confirm import' }));
    const alert = (await screen.findByText('This review has expired. Choose the file again to check it.')).closest('[data-slot="alert"]') as HTMLElement;
    await user.click(within(alert).getByRole('button', { name: 'Choose file again' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Select file' })).toHaveFocus();
  });

  it('Matched by similar name rows wait for a decision with nothing chosen, counted by the panel and held by the gate', async () => {
    const { user } = await renderSimilar();
    const row = within(previewTable()).getByRole('row', { name: /Row 3/ });
    expect(within(row).getByText('Matched by similar name').closest('[data-tone]')).toHaveAttribute('data-tone', 'warning');
    expect(within(row).getByText(`Similar to the existing Risk Type “${STORED}”.`)).toBeInTheDocument();
    const group = decisionGroup(3);
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'false']);
    expect(within(group).getByRole('radio', { name: `Update “${STORED}”` })).toBeInTheDocument();
    expect(within(group).getByRole('radio', { name: 'Skip this row' })).toBeInTheDocument();
    expect(within(group).getByText('Uses this row’s other values and keeps the existing name.')).toBeInTheDocument();
    expect(within(group).getByText(`Leaves “${STORED}” as it is.`)).toBeInTheDocument();

    const panel = screen.getByText('2 rows match an existing name only by capitals or spacing').closest('[data-slot="alert"]') as HTMLElement;
    expect(panel).toHaveTextContent('Choose to update the existing Risk Type or skip the row. No new Risk Types are created for these rows.');
    expect(within(panel).getByText('0 of 2 decided')).toHaveAttribute('aria-live', 'polite');

    await user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Review rows' })).toBeInTheDocument();
    expect(screen.getByText('Choose Update or Skip for 2 more rows.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Matched by similar name (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(decisionGroup(3)).getAllByRole('radio')[0]).toHaveFocus();

    await user.click(within(decisionGroup(3)).getByRole('radio', { name: `Update “${STORED}”` }));
    expect(within(panel).getByText('1 of 2 decided')).toBeInTheDocument();
    expect(within(within(previewTable()).getByRole('row', { name: /Row 3/ })).getByText('Your choice: Update')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    expect(screen.getByText('Choose Update or Skip for 1 more row.')).toBeInTheDocument();
    expect(within(decisionGroup(4)).getAllByRole('radio')[0]).toHaveFocus();
  });

  it('Update all and Skip all set every similar row, with an Undo toast only when they replace a choice', async () => {
    const { user } = await renderSimilar();
    const checked = () => [3, 4].map((rowNumber) => within(decisionGroup(rowNumber)).getAllByRole('radio').map((radio) => radio.getAttribute('aria-checked')).join(','));
    await user.click(screen.getByRole('button', { name: 'Update all 2' }));
    expect(checked()).toEqual(['true,false', 'true,false']);
    expect(importMocks.toastSuccess).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Skip all 2' }));
    expect(checked()).toEqual(['false,true', 'false,true']);
    expect(importMocks.toastSuccess).toHaveBeenCalledTimes(1);
    const [message, options] = importMocks.toastSuccess.mock.calls[0] as [string, { action?: { label: string; onClick: (event: unknown) => void } }];
    expect(message).toBe('Set 2 rows to Skip');
    expect(options.action?.label).toBe('Undo');
    act(() => options.action!.onClick({}));
    expect(checked()).toEqual(['true,false', 'true,false']);

    await user.click(screen.getByRole('button', { name: 'Show these rows' }));
    expect(screen.getByRole('button', { name: 'Matched by similar name (2)' })).toHaveAttribute('aria-pressed', 'true');
  });

  /* FE4-08 (X-14): an Undo belongs to the review it was offered in; another file's preview takes none of its choices. */
  it('lets a bulk Undo still in view restore nothing onto another file’s preview', async () => {
    const { user, previewAction } = await renderSimilar();
    await user.click(screen.getByRole('button', { name: 'Update all 2' }));
    await user.click(screen.getByRole('button', { name: 'Skip all 2' }));
    const [, options] = importMocks.toastSuccess.mock.calls[0] as [string, { action?: { label: string; onClick: (event: unknown) => void } }];
    expect(options.action?.label).toBe('Undo');

    previewAction.mockResolvedValueOnce({ ok: true, data: { ...similarPreview(), previewDigest: `sha256:${'3'.repeat(64)}` } });
    await user.click(screen.getByRole('button', { name: 'Back to file selection' }));
    await user.click(within(screen.getByText('Choosing another file clears your 2 choices.').closest('[data-slot="alert"]') as HTMLElement).getByRole('button', { name: 'Choose another file' }));
    await user.click(screen.getByRole('button', { name: 'Validate and preview' }));
    await screen.findByRole('heading', { level: 2, name: 'Review rows' });
    expect(screen.getByText('0 of 2 decided')).toBeInTheDocument();

    act(() => options.action!.onClick({}));
    expect(screen.getByText('0 of 2 decided')).toBeInTheDocument();
    for (const rowNumber of [3, 4]) {
      for (const radio of within(decisionGroup(rowNumber)).getAllByRole('radio')) expect(radio).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('keeps the choices between Review and Confirm, and the new-file guard asks before clearing them', async () => {
    const { user } = await renderSimilar();
    await user.click(within(decisionGroup(3)).getByRole('radio', { name: 'Skip this row' }));
    await user.click(within(decisionGroup(4)).getByRole('radio', { name: /^Update/ }));
    await user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Confirm import' })).toBeInTheDocument();
    expect(screen.getByText(/This import will create 1 and update 1 Risk Types, including 1 matched by similar name\. 1 row will be skipped: 1 you chose to skip\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to review rows' }));
    expect(within(decisionGroup(3)).getByRole('radio', { name: 'Skip this row' })).toHaveAttribute('aria-checked', 'true');
    expect(within(decisionGroup(4)).getByRole('radio', { name: /^Update/ })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: 'Back to file selection' }));
    const guard = screen.getByText('Choosing another file clears your 2 choices.').closest('[data-slot="alert"]') as HTMLElement;
    await user.click(within(guard).getByRole('button', { name: 'Keep reviewing' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Review rows' })).toBeInTheDocument();
    expect(screen.queryByText('Choosing another file clears your 2 choices.')).not.toBeInTheDocument();
    expect(within(decisionGroup(3)).getByRole('radio', { name: 'Skip this row' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: 'Back to file selection' }));
    await user.click(within(screen.getByText('Choosing another file clears your 2 choices.').closest('[data-slot="alert"]') as HTMLElement).getByRole('button', { name: 'Choose another file' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Select file' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Validate and preview' }));
    await screen.findByRole('heading', { level: 2, name: 'Review rows' });
    expect(screen.getByText('0 of 2 decided')).toBeInTheDocument();
  });

  it('the commit sends each similar row’s decision, and Results show Skipped by you', async () => {
    const commitAction = vi.fn().mockResolvedValue({ ok: true, data: {
      fileName: 'risk-types.csv', previewDigest: `sha256:${'1'.repeat(64)}`, resultToken: `sha256:${'2'.repeat(64)}`, limits: { maxBytes: 5_242_880, maxRows: 5_000 },
      summary: { create: 1, update: 1, unchanged: 0, rejected: 0, ambiguous: 0, skipped: 1 },
      previewChanged: 0,
      rows: [
        { rowNumber: 2, naturalKey: 'New risk', state: 'create', documentId: 'risk-type-2', issues: [] },
        { rowNumber: 3, naturalKey: 'uat-b: core customer billing system', state: 'similar', decision: 'skip', issues: [] },
        { rowNumber: 4, naturalKey: 'UAT-B:  Core customer billing  platform', state: 'similar', decision: 'update', documentId: 'risk-type-4', issues: [] },
      ],
    } });
    const { user } = await renderSimilar(commitAction);
    await user.click(within(decisionGroup(4)).getByRole('radio', { name: /^Update/ }));
    await user.click(within(decisionGroup(3)).getByRole('radio', { name: 'Skip this row' }));
    await user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    await user.click(screen.getByRole('checkbox', { name: 'I have reviewed the rows to create and update.' }));
    await user.click(screen.getByRole('button', { name: 'Confirm import' }));
    const sent = commitAction.mock.calls[0]?.[0] as FormData;
    expect(sent.get('decisions')).toBe('{"3":"skip","4":"update"}');
    expect(sent.get('confirmed')).toBe('true');

    await screen.findByRole('heading', { level: 2, name: 'Import complete' });
    for (const text of ['Created 1', 'Updated 1', 'Unchanged 0', 'Rejected 0', 'Ambiguous 0', 'Skipped by you 1']) expect(screen.getByText(text)).toBeInTheDocument();
    const results = screen.getByRole('table', { name: 'Risk Type import results' });
    const skipped = within(results).getAllByRole('row')[2]!;
    expect(within(skipped).getByText('Matched by similar name')).toBeInTheDocument();
    expect(within(skipped).getByText('Skipped by your choice.')).toBeInTheDocument();
    expect(within(within(results).getAllByRole('row')[3]!).getByRole('link', { name: 'View record' })).toHaveAttribute('href', '/app/admin/risk-types/risk-type-4');
    // Only the person's own skip was left out, so there is nothing to correct.
    expect(screen.queryByRole('button', { name: 'Download error report' })).not.toBeInTheDocument();
  });

  it('returns to Review rows with the similar filter when the commit misses a decision', async () => {
    const commitAction = vi.fn().mockResolvedValue({
      ok: false,
      formError: 'Choose Update or Skip for every row matched by similar name, then confirm again.',
      refusal: { family: 'step', step: 'decision-missing', message: 'Choose Update or Skip for every row matched by similar name, then confirm again.', action: null },
    });
    const { user } = await renderSimilar(commitAction);
    await user.click(screen.getByRole('button', { name: 'Update all 2' }));
    await user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    await user.click(screen.getByRole('checkbox', { name: 'I have reviewed the rows to create and update.' }));
    await user.click(screen.getByRole('button', { name: 'Confirm import' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Review rows' })).toHaveFocus();
    expect(screen.getByText('Choose Update or Skip for every row matched by similar name, then confirm again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Matched by similar name (2)' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers the error report at Review with the preview token and at Results with the result token, then saves it', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const errorReportAction = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce({ ok: false, refusal: { message: 'We couldn’t prepare the error report.', action: 'Try again' } })
      .mockResolvedValueOnce({ ok: true, fileName: ISSUES_NAME, contentType: 'text/csv; charset=utf-8', bytes: new Uint8Array([0xef, 0xbb, 0xbf, 0x4e]), rowCount: 1 });
    const commitAction = vi.fn().mockResolvedValue({ ok: true, data: {
      fileName: 'risk-types.csv', previewDigest: `sha256:${'1'.repeat(64)}`, resultToken: `sha256:${'2'.repeat(64)}`, limits: { maxBytes: 5_242_880, maxRows: 5_000 },
      summary: { create: 1, update: 0, unchanged: 0, rejected: 1, ambiguous: 0, skipped: 0 },
      previewChanged: 0,
      rows: [
        { rowNumber: 2, naturalKey: 'Create', state: 'create', documentId: 'risk-type-2', issues: [] },
        { rowNumber: 3, naturalKey: 'Rejected', state: 'rejected', issues: [{ code: 'REQUIRED_VALUE', field: 'name', message: 'Enter a name.' }] },
      ],
    } });
    const { user } = await renderPreview(loadedFlow!, [
      { rowNumber: 2, naturalKey: 'Create', state: 'create', issues: [] },
      { rowNumber: 3, naturalKey: 'Rejected', state: 'rejected', issues: ['Enter a name.'] },
    ], commitAction, {}, { errorReportAction });

    expect(screen.getByText('The rows that weren’t imported, exactly as in your file, with an Issues column. Correct them and import the file again.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download error report' }));
    expect(screen.getByRole('button', { name: 'Preparing error report…' })).toHaveAttribute('aria-disabled', 'true');
    const atReview = errorReportAction.mock.calls[0]?.[0] as FormData;
    expect(atReview.get('kind')).toBe('risk-types');
    expect((atReview.get('file') as File).name).toBe('risk-types.csv');
    expect(atReview.get('previewDigest')).toBe(`sha256:${'1'.repeat(64)}`);
    expect(atReview.get('resultToken')).toBeNull();
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x4e]);
    await act(async () => finish({ ok: true, fileName: ISSUES_NAME, contentType: 'text/csv; charset=utf-8', bytes, rowCount: 1 }));
    expect(importMocks.saveFile).toHaveBeenCalledWith({ fileName: ISSUES_NAME, contentType: 'text/csv; charset=utf-8', bytes });
    expect(importMocks.toastSuccess).toHaveBeenCalledWith(`Downloaded ${ISSUES_NAME}`, expect.objectContaining({ description: '1 row to correct.' }));

    await user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    await user.click(screen.getByRole('checkbox', { name: 'I have reviewed the rows to create and update.' }));
    await user.click(screen.getByRole('button', { name: 'Confirm import' }));
    await screen.findByRole('heading', { level: 2, name: 'Import completed with rejected rows' });
    await user.click(screen.getByRole('button', { name: 'Download error report' }));
    const atResults = errorReportAction.mock.calls[1]?.[0] as FormData;
    expect(atResults.get('resultToken')).toBe(`sha256:${'2'.repeat(64)}`);
    expect(atResults.get('previewDigest')).toBeNull();
    expect(await screen.findByText('We couldn’t prepare the error report.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(importMocks.saveFile).toHaveBeenCalledTimes(1);

    // FE4-04 (WCAG 2.4.3): Try again removes itself, so focus moves to the error report it retried, never the page body.
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(importMocks.saveFile).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download error report' })).toHaveFocus());
  });

  /* FE4-05 (19-UI-SPEC §5.5, §9 G-4): each summary figure selects its state's rows; a zero figure is plain text. */
  it('selects a state’s rows from its summary figure, and leaves a zero figure plain', async () => {
    const { user } = await renderPreview(loadedFlow!, [
      { rowNumber: 2, naturalKey: 'Created row', state: 'create', issues: [] },
      { rowNumber: 3, naturalKey: 'First rejected', state: 'rejected', issues: ['Enter a name.'] },
      { rowNumber: 4, naturalKey: 'Second rejected', state: 'rejected', issues: ['Enter a name.'] },
    ], vi.fn(), {}, { errorReportAction: vi.fn() });

    const figure = screen.getByRole('button', { name: '2 Rejected' });
    expect(figure).toHaveTextContent(/^2$/);
    expect(figure).toHaveAttribute('aria-pressed', 'false');
    await user.click(figure);

    const table = previewTable();
    expect(within(table).getByText('First rejected')).toBeInTheDocument();
    expect(within(table).getByText('Second rejected')).toBeInTheDocument();
    expect(within(table).queryByText('Created row')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejected (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2 Rejected' })).toHaveAttribute('aria-pressed', 'true');
    // The four states with no rows show their 0 as plain text.
    expect(screen.queryAllByRole('button', { name: /^0 / })).toHaveLength(0);
    expect(screen.getAllByText(/^0$/)).toHaveLength(4);
  });

  it('offers no error report at Review when every row will be written or is unchanged', async () => {
    await renderPreview(loadedFlow!, [
      { rowNumber: 2, naturalKey: 'Create', state: 'create', issues: [] },
      { rowNumber: 3, naturalKey: 'Unchanged', state: 'unchanged', issues: [] },
    ], vi.fn(), {}, { errorReportAction: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Download error report' })).not.toBeInTheDocument();
  });

  /* 19-UI-REVIEW (pilot ruling, 2026-10-17): the import flow's audit warnings, each proved before its fix. */
  describe('the UI review (19-UI-REVIEW)', () => {
    it('UI-01 keeps focus on a pending template button, read-only by aria-disabled, and a second press sends nothing', async () => {
      const user = userEvent.setup();
      let finish: (value: unknown) => void = () => undefined;
      const templateAction = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
      const Flow = loadedFlow!;
      render(<Flow kind="risk-types" previewAction={vi.fn()} commitAction={vi.fn()} templateAction={templateAction} />);

      await user.click(screen.getByRole('button', { name: 'Download Excel template' }));
      const pending = screen.getByRole('button', { name: 'Downloading…' });
      expect(pending).toBeEnabled();
      expect(pending).toHaveAttribute('aria-disabled', 'true');
      expect(pending).toHaveFocus();
      const other = screen.getByRole('button', { name: 'Download CSV template' });
      expect(other).toBeEnabled();
      expect(other).toHaveAttribute('aria-disabled', 'true');
      await user.click(pending);
      await user.click(other);
      expect(templateAction).toHaveBeenCalledTimes(1);

      await act(async () => finish({ ok: true, fileName: 'risk-types-import-template.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: new Uint8Array([0x50]) }));
      expect(screen.getByRole('button', { name: 'Download Excel template' })).not.toHaveAttribute('aria-disabled');
      expect(screen.getByRole('button', { name: 'Download CSV template' })).toHaveFocus();
    });

    it('UI-01 and UI-11 keep focus on a pending error report button, and announce its refusal', async () => {
      let finish: (value: unknown) => void = () => undefined;
      const errorReportAction = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
      const { user } = await renderPreview(loadedFlow!, [
        { rowNumber: 2, naturalKey: 'Create', state: 'create', issues: [] },
        { rowNumber: 3, naturalKey: 'Rejected', state: 'rejected', issues: ['Enter a name.'] },
      ], vi.fn(), {}, { errorReportAction });

      await user.click(screen.getByRole('button', { name: 'Download error report' }));
      const pending = screen.getByRole('button', { name: 'Preparing error report…' });
      expect(pending).toBeEnabled();
      expect(pending).toHaveFocus();
      await user.click(pending);
      expect(errorReportAction).toHaveBeenCalledTimes(1);

      await act(async () => finish({ ok: false, refusal: { message: 'We couldn’t prepare the error report.', action: 'Try again' } }));
      expect(screen.getByText('We couldn’t prepare the error report.').closest('[role="alert"]')).not.toBeNull();
    });

    it('UI-02 and UI-03 make the similar panel no alert, and describe each undecided group by the gate line', async () => {
      const { user } = await renderSimilar();
      const panel = screen.getByText('2 rows match an existing name only by capitals or spacing').closest('[data-slot="alert"]') as HTMLElement;
      expect(panel).not.toHaveAttribute('role', 'alert');
      expect(within(panel).getByText('0 of 2 decided')).toHaveAttribute('aria-live', 'polite');

      await user.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
      const gate = screen.getByText('Choose Update or Skip for 2 more rows.').closest('p') as HTMLElement;
      expect(gate.id).not.toBe('');
      expect(decisionGroup(3).getAttribute('aria-describedby')?.split(' ')).toContain(gate.id);
      expect(decisionGroup(4).getAttribute('aria-describedby')?.split(' ')).toContain(gate.id);

      await user.click(within(decisionGroup(3)).getByRole('radio', { name: `Update “${STORED}”` }));
      expect(decisionGroup(3).getAttribute('aria-describedby') ?? '').not.toContain(gate.id);
      expect(decisionGroup(4).getAttribute('aria-describedby')?.split(' ')).toContain(gate.id);
    });

    it('UI-07 to UI-10 keep the review on the §3.9 and §3.10 scales', async () => {
      await renderSimilar();
      // UI-07: a summary figure is the 20px heading step, as a button and as plain text.
      const figure = screen.getByRole('button', { name: '1 Create' });
      expect(figure).toHaveClass('text-heading-md');
      expect(figure).not.toHaveClass('text-2xl');
      for (const zero of screen.getAllByText(/^0$/)) expect(zero).toHaveClass('text-heading-md');
      // UI-08: a phone card's File row label is weight 500, never a 700 strong.
      const cards = screen.getAllByText(/^File row \d+$/).filter((label) => label.closest('[data-slot="csv-import-mobile"]'));
      expect(cards.length).toBeGreaterThan(0);
      for (const label of cards) {
        expect(label.tagName).not.toBe('STRONG');
        expect(label).toHaveClass('font-medium');
      }
      // UI-09: the step body's blocks are 24px apart.
      expect(screen.getByRole('heading', { level: 2, name: 'Review rows' }).closest('[data-slot="card"]')?.querySelector('[data-slot="card-content"]')).toHaveClass('gap-6');
      // UI-10: a similar row's decision sits 16px below its details.
      expect(decisionGroup(3)).toHaveClass('mt-4');
    });

    it('UI-11 and UI-12 announce Choose one file to check. with its icon, and name the file field as a group', async () => {
      const user = userEvent.setup();
      const Flow = loadedFlow!;
      render(<Flow kind="risk-types" previewAction={vi.fn()} commitAction={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Choose file' }));

      const group = screen.getByRole('group', { name: 'File to import' });
      expect(within(group).getByRole('button', { name: 'Choose file' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Validate and preview' }));
      const line = screen.getByText('Choose one file to check.');
      expect(line.closest('[role="alert"]')).not.toBeNull();
      expect(line.closest('[role="alert"]')?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    });
  });
});

describe('D-29 Risk Type control search on the server', () => {
  afterEach(() => get.mockReset());

  const listed = (data: readonly Record<string, unknown>[]) => ({
    data: { data, meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: data.length } } },
    response: { status: 200 },
  });
  const controlRecord = (documentId: string, controlNumber: string, name: string, framework: string) => ({
    documentId, controlNumber, name, framework, description: null, controlType: null,
    controlReference: null, frameworkVersion: null, frameworkSource: null,
  });

  it('asks the Administration control list for one bounded page and labels each option', async () => {
    get.mockResolvedValueOnce(listed([
      controlRecord('control-app-11', 'APP-11', 'APP-11 — Security of personal information', 'Privacy Act 1988'),
      controlRecord('control-5-1', '5.1', '5.1', 'ISO/IEC 27001 Information security management systems — Annex A'),
    ]));
    const { searchApplicableControlsAction } = await import('./administration-actions');

    await expect(searchApplicableControlsAction('APP')).resolves.toEqual([
      { documentId: 'control-app-11', label: 'APP-11 · Security of personal information' },
      { documentId: 'control-5-1', label: '5.1 · ISO/IEC 27001 Information security management systems — Annex A' },
    ]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/v1/controls', { params: { query: { q: 'APP', sort: 'controlNumber:asc', page: 1, pageSize: 25 } } });
  });

  it.each(['', '   ', 42, 'x'.repeat(201)])('returns no options without a call for the search %j', async (search) => {
    const { searchApplicableControlsAction } = await import('./administration-actions');
    await expect(searchApplicableControlsAction(search)).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it('returns no options when the control list is refused', async () => {
    get.mockResolvedValueOnce({ data: undefined, error: { error: { status: 403 } }, response: { status: 403 } });
    const { searchApplicableControlsAction } = await import('./administration-actions');
    await expect(searchApplicableControlsAction('APP')).resolves.toEqual([]);
  });
});

describe('ADMIN-01 capability-gated Administration discovery', () => {
  it('grants and renders the Reference data section only for Bob', async () => {
    const [{ DevelopmentCapabilityAdapter }, { CapabilityNavigation }] = await Promise.all([
      import('@/lib/capabilities/development-capabilities'),
      import('@/components/shell/capability-navigation'),
    ]);
    const bob = await new DevelopmentCapabilityAdapter('Security Analyst').granted();
    const jane = await new DevelopmentCapabilityAdapter('Requestor').granted();

    expect(bob.has('administration:manage' as never)).toBe(true);
    expect(jane.has('administration:manage' as never)).toBe(false);
    const view = render(<CapabilityNavigation granted={bob} />);
    expect(screen.getByRole('group', { name: 'Reference data' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Risk Types' })).toHaveAttribute('href', '/app/admin/risk-types');
    expect(screen.getByRole('link', { name: 'Controls' })).toHaveAttribute('href', '/app/admin/controls');
    expect(screen.getByRole('link', { name: 'Information Systems' })).toHaveAttribute('href', '/app/admin/information-systems');
    expect(screen.getByRole('link', { name: 'Information Assets' })).toHaveAttribute('href', '/app/admin/information-assets');
    view.rerender(<CapabilityNavigation granted={jane} />);
    expect(screen.queryByRole('group', { name: 'Reference data' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Risk Types' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Information Systems' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Information Assets' })).not.toBeInTheDocument();
  });
});
