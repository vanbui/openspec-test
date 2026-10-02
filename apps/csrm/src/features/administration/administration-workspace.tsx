'use client';

import type { SortingState } from '@tanstack/react-table';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { DataTable, type DataTableColumn } from '@/components/csrm/data-table';
import { nativeSelectClassName } from '@/components/csrm/native-select';
import { PageHeader } from '@/components/csrm/page-header';
import { RecordLink } from '@/components/csrm/record-link';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { buttonVariants } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Input } from '@/components/ui/input';
import { controlLabel, controlTitle } from '@/features/assessments/control-label';
import { administrationSearchDelayMs, getAdministrationConfig, type AdministrationKind } from './administration-config';
import {
  administrationPageSizes,
  controlTypeValues,
  dataClassificationValues,
  deploymentModelValues,
  lifecycleStateValues,
  systemEnvironmentValues,
} from './administration-domain';
import type {
  AdministrationQuery,
  ControlAdministrationRecord,
  InformationAssetAdministrationRecord,
  InformationSystemAdministrationRecord,
  RiskTypeAdministrationRecord,
} from './administration-schema';

/*
 * The Administration collection lists, their headers, breadcrumbs and denials. The create and edit
 * form, which validates with zod in the browser, lives in administration-form.tsx, so a list page
 * never downloads the validation library (plan 08-13, D-24).
 */

export type AdministrationWorkspaceState = 'ready' | 'loading' | 'empty' | 'error' | 'permission';
type Pagination = { page: number; pageSize: number; pageCount: number; total: number };
type AdministrationWorkspaceRecord = Pick<RiskTypeAdministrationRecord, 'documentId' | 'name' | 'description'> & Partial<
  Omit<RiskTypeAdministrationRecord, 'documentId' | 'name' | 'description'>
  & Omit<ControlAdministrationRecord, 'documentId' | 'name' | 'description'>
  & Omit<InformationSystemAdministrationRecord, 'documentId' | 'name' | 'description'>
  & Omit<InformationAssetAdministrationRecord, 'documentId' | 'name' | 'description'>
>;

export type AdministrationWorkspaceProps = {
  kind: AdministrationKind;
  state: AdministrationWorkspaceState;
  items: readonly AdministrationWorkspaceRecord[];
  query: AdministrationQuery;
  pagination: Pagination;
  densityUserId?: string;
  onSearch?: (value: string) => void;
};

function queryString(query: AdministrationQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.framework) params.set('framework', query.framework);
  if (query.controlType) params.set('controlType', query.controlType);
  for (const key of ['environment', 'deploymentModel', 'lifecycleState', 'internetFacing', 'dataClassification', 'containsPersonalData', 'containsLegalData', 'containsCreditCardData'] as const) {
    if (query[key]) params.set(key, query[key]);
  }
  params.set('sort', query.sort);
  if (query.page > 1) params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return params.toString();
}

function sortingFor(sort: AdministrationQuery['sort']): SortingState {
  const [id, direction] = sort.split(':') as [string, 'asc' | 'desc'];
  return [{ id, desc: direction === 'desc' }];
}

function emptyState(filtered: boolean, config: ReturnType<typeof getAdministrationConfig>, onClear: () => void) {
  return <EmptyState action={{ label: `Create ${config.label}`, href: config.newPath }} filtered={filtered} noun={config.pluralLabel} onClearFilters={onClear} />;
}

const yesNo = (value: unknown) => value === true ? 'Yes' : 'No';

/*
 * The Information System owner and business criticality as the systems list and its mobile card read
 * them (D-37, UI-SPEC §16.4): the owner's served name, `Name not available` for an owner without one,
 * and `Not provided` when there is no owner or no criticality. The owner id is never shown.
 */
function systemOwnerLabel(record: AdministrationWorkspaceRecord): string {
  if (typeof record.owner !== 'string' || !record.owner) return 'Not provided';
  return record.ownerName?.trim() || 'Name not available';
}

function systemCriticalityLabel(record: AdministrationWorkspaceRecord): string {
  return record.businessCriticality?.trim() || 'Not provided';
}

/*
 * A name or a short label whose stored text may still be long (a Reference or Location of up to 500 characters; a
 * Name, Owner or Business criticality of up to 255). It is capped at the long-text maximum (28rem, direction §4
 * DataTable) and clamps to two lines with the full text in the DOM, so one long value cannot push the other columns
 * out of view (WR-309). It takes no 14rem minimum: that belongs to statement and title columns (the `wrap` option),
 * and a short value here keeps a compact, one-line column (10-23 fix 7).
 */
const boundedTextClassName = 'line-clamp-2 max-w-md whitespace-normal break-words';

/*
 * A control's name as the controls list reads it: the title part, or `Not provided` for an untitled control,
 * so the number shows once in its row. The mobile card has no number column, so it uses the full control
 * label (D-36, UI-SPEC §16.2).
 */
function controlNameCell(record: AdministrationWorkspaceRecord): string {
  return controlTitle({ controlNumber: record.controlNumber ?? '', name: record.name }) ?? 'Not provided';
}

function mobileCardTitle(record: AdministrationWorkspaceRecord): string {
  return typeof record.controlNumber === 'string'
    ? controlLabel({ controlNumber: record.controlNumber, name: record.name, framework: record.framework })
    : record.name;
}

/* Each collection's purpose, under its heading on the list and on its denial alike. */
const collectionDescriptions: Record<AdministrationKind, string> = {
  'risk-types': 'Manage the Risk Types used to identify Risks in assessments.',
  controls: 'Manage the control library used for mitigation controls on Risks.',
  'information-systems': 'Manage the organisational Information Systems available to assessment workflows.',
  'information-assets': 'Manage the organisational Information Assets available to assessment workflows.',
};

/*
 * A refused Administration page still says which page it is: the collection's page header (the
 * page's one level-one heading) above the shared permission state, like every other denial. Without
 * a known collection the heading is Administration. Neither names a record.
 */
export function AdministrationAccessDenied({ kind }: { kind?: AdministrationKind } = {}) {
  return (
    <>
      <PageHeader
        description={kind ? collectionDescriptions[kind] : 'Administration records are managed by Security Analysts.'}
        title={kind ? getAdministrationConfig(kind).pluralLabel : 'Administration'}
      />
      <PermissionDeniedState area="Administration records" />
    </>
  );
}

export function AdministrationUnavailableState({ error = false, kind = 'risk-types' }: { error?: boolean; kind?: AdministrationKind }) {
  const config = getAdministrationConfig(kind);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-6 text-center" role="alert">
      <h1 className="text-heading-lg font-display text-foreground">
        {error ? `We couldn’t load this ${config.label}.` : `This ${config.label} is not available.`}
      </h1>
      <p className="text-sm text-muted-foreground">{error ? 'Check your connection and try again.' : `Return to ${config.pluralLabel} to continue.`}</p>
      <Link className={buttonVariants({ variant: 'outline' })} href={config.listPath}>Return to {config.pluralLabel}</Link>
    </section>
  );
}

export function AdministrationBreadcrumbs({ kind, current }: { kind: AdministrationKind; current?: string }) {
  const config = getAdministrationConfig(kind);
  return <Breadcrumb><BreadcrumbList>
    <BreadcrumbItem><BreadcrumbLink asChild><Link href="/app/admin/risk-types">Administration</Link></BreadcrumbLink></BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>{current ? <BreadcrumbLink asChild><Link href={config.listPath}>{config.pluralLabel}</Link></BreadcrumbLink> : <BreadcrumbPage>{config.pluralLabel}</BreadcrumbPage>}</BreadcrumbItem>
    {current ? <><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{current}</BreadcrumbPage></BreadcrumbItem></> : null}
  </BreadcrumbList></Breadcrumb>;
}

export function AdministrationWorkspace({ densityUserId = 'security-analyst', items, kind, onSearch, pagination, query, state }: AdministrationWorkspaceProps) {
  const config = getAdministrationConfig(kind);
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q);
  const [framework, setFramework] = useState(query.framework ?? '');
  const submittedSearch = useRef(query.q);
  const submittedFramework = useRef(query.framework ?? '');
  const searchTimerRef = useRef<number | null>(null);

  useEffect(() => setSearch(query.q), [query.q]);
  useEffect(() => setFramework(query.framework ?? ''), [query.framework]);
  useEffect(() => {
    if (search === submittedSearch.current) return;
    const timer = window.setTimeout(() => {
      searchTimerRef.current = null;
      submittedSearch.current = search;
      if (onSearch) onSearch(search);
      else startTransition(() => router.replace(`${pathname}?${queryString({ ...query, q: search, page: 1 })}`, { scroll: false }));
    }, administrationSearchDelayMs);
    searchTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (searchTimerRef.current === timer) searchTimerRef.current = null;
    };
  }, [onSearch, pathname, query, router, search]);
  useEffect(() => {
    if (kind !== 'controls' || framework === submittedFramework.current) return;
    const timer = window.setTimeout(() => {
      submittedFramework.current = framework;
      startTransition(() => router.replace(`${pathname}?${queryString({ ...query, framework: framework || undefined, page: 1 })}`, { scroll: false }));
    }, administrationSearchDelayMs);
    return () => window.clearTimeout(timer);
  }, [framework, kind, pathname, query, router]);

  // The denial brings its own page header, so it returns before the collection's header renders.
  if (state === 'permission') return <AdministrationAccessDenied kind={kind} />;

  const navigate = (changes: Partial<AdministrationQuery>) => {
    startTransition(() => router.replace(`${pathname}?${queryString({ ...query, ...changes })}`, { scroll: false }));
  };
  const submitSearch = () => {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    submittedSearch.current = search;
    if (onSearch) onSearch(search);
    else navigate({ q: search, page: 1 });
  };
  const riskTypeColumns: DataTableColumn<AdministrationWorkspaceRecord>[] = [
    {
      accessorKey: 'name', header: 'Name', enableSorting: true,
      cell: (_value, record) => <RecordLink className={boundedTextClassName} href={config.detailPath(record.documentId)}>{record.name}</RecordLink>,
    },
    // Long text (direction §4 DataTable, X-3): wraps within the column bounds and clamps to two lines.
    { accessorKey: 'description', header: 'Description', wrap: true, cell: (value) => <span className="line-clamp-2">{String(value ?? 'Not provided')}</span> },
    { accessorKey: 'applicableControls', header: 'Applicable controls', numeric: 'magnitude', cell: (value) => Array.isArray(value) ? value.length : 0 },
  ];
  const controlColumns: DataTableColumn<AdministrationWorkspaceRecord>[] = [
    { accessorKey: 'controlNumber', header: 'Control number', enableSorting: true, cell: (_value, record) => <RecordLink href={config.detailPath(record.documentId)}>{'controlNumber' in record ? record.controlNumber : ''}</RecordLink> },
    // The number has its own column, so Name carries the title part only (D-36, UI-SPEC §16.2). Titles and
    // framework names are long text (direction §4 DataTable, X-3): they wrap within the column bounds and clamp
    // to two lines, so a long title never pushes Type and Reference out of view at 1440 (B3).
    { accessorKey: 'name', header: 'Name', enableSorting: true, wrap: true, cell: (_value, record) => <span className="line-clamp-2">{controlNameCell(record)}</span> },
    { accessorKey: 'framework', header: 'Framework', wrap: true, cell: (value) => <span className="line-clamp-2">{String(value)}</span> },
    { accessorKey: 'controlType', header: 'Type', cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'controlReference', header: 'Reference', cell: (value) => <span className={boundedTextClassName}>{String(value ?? 'Not provided')}</span> },
  ];
  const systemColumns: DataTableColumn<AdministrationWorkspaceRecord>[] = [
    { accessorKey: 'name', header: 'Name', enableSorting: true, cell: (value, record) => <RecordLink className={boundedTextClassName} href={config.detailPath(record.documentId)}>{String(value)}</RecordLink> },
    // Owner and Business criticality follow Name so the oversight columns stay in view; neither sorts (UI-D23).
    { accessorKey: 'ownerName', header: 'Owner', cell: (_value, record) => <span className={boundedTextClassName}>{systemOwnerLabel(record)}</span> },
    { accessorKey: 'businessCriticality', header: 'Business criticality', cell: (_value, record) => <span className={boundedTextClassName}>{systemCriticalityLabel(record)}</span> },
    { accessorKey: 'systemType', header: 'Type', enableSorting: true, cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'environment', header: 'Environment', enableSorting: true, cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'deploymentModel', header: 'Deployment model', cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'lifecycleState', header: 'Lifecycle', enableSorting: true, cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'internetFacing', header: 'Internet-facing', cell: (value) => yesNo(value) },
  ];
  const assetColumns: DataTableColumn<AdministrationWorkspaceRecord>[] = [
    { accessorKey: 'name', header: 'Name', enableSorting: true, cell: (value, record) => <RecordLink className={boundedTextClassName} href={config.detailPath(record.documentId)}>{String(value)}</RecordLink> },
    { accessorKey: 'type', header: 'Type', enableSorting: true, cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'dataClassification', header: 'Classification', enableSorting: true, cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'location', header: 'Location', cell: (value) => <span className={boundedTextClassName}>{String(value ?? 'Not provided')}</span> },
    { accessorKey: 'containsPersonalData', header: 'Sensitive-data flags', cell: (_value, record) => 'containsPersonalData' in record ? `Personal: ${yesNo(record.containsPersonalData)} · Legal: ${yesNo(record.containsLegalData)} · Credit card: ${yesNo(record.containsCreditCardData)}` : 'Not provided' },
  ];
  const columns = kind === 'controls' ? controlColumns : kind === 'information-systems' ? systemColumns : kind === 'information-assets' ? assetColumns : riskTypeColumns;
  const resolvedState = state === 'ready' && items.length === 0 ? 'empty' : state === 'ready' ? 'populated' : state;
  const sorting = sortingFor(query.sort);
  const frameworkSuggestions = kind === 'controls'
    ? [...new Set(items.flatMap((record) => record.framework ? [record.framework] : []))]
    : [];
  const sortableFields = kind === 'controls' ? ['controlNumber', 'name'] : kind === 'information-systems' ? ['name', 'systemType', 'environment', 'lifecycleState'] : kind === 'information-assets' ? ['name', 'type', 'dataClassification'] : ['name'];

  return (
    <div className="space-y-6">
      <PageHeader
        description={collectionDescriptions[kind]}
        title={config.pluralLabel}
        action={<div className="flex w-full flex-col gap-2 md:w-auto md:flex-row-reverse"><Link className={buttonVariants()} href={config.newPath}>Create {config.label}</Link><Link className={buttonVariants({ variant: 'outline' })} href={`${config.listPath}/import`}>Import CSV</Link></div>}
      />
      <form role="search" className="grid max-w-3xl gap-4 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
        <fieldset className="contents" disabled={isPending}>
        <label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor="administration-search">Search {config.pluralLabel}<Input id="administration-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitSearch(); } }} /></label>
        {kind === 'controls' ? <><label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor="control-framework">Framework<Input id="control-framework" list="control-framework-suggestions" value={framework} onChange={(event) => setFramework(event.target.value)} /><datalist id="control-framework-suggestions">{frameworkSuggestions.map((value) => <option key={value} value={value} />)}</datalist></label><label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor="control-type">Control type<select className={`${nativeSelectClassName} block w-full`} id="control-type" value={query.controlType ?? ''} onChange={(event) => navigate({ controlType: event.target.value as AdministrationQuery['controlType'] || undefined, page: 1 })}><option value="">All types</option>{controlTypeValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></> : null}
        {kind === 'information-systems' ? <><label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor="system-environment-filter">Environment<select className={`${nativeSelectClassName} block w-full`} id="system-environment-filter" value={query.environment ?? ''} onChange={(event) => navigate({ environment: event.target.value as AdministrationQuery['environment'] || undefined, page: 1 })}><option value="">All environments</option>{systemEnvironmentValues.map((value) => <option key={value}>{value}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor="system-deployment-filter">Deployment model<select className={`${nativeSelectClassName} block w-full`} id="system-deployment-filter" value={query.deploymentModel ?? ''} onChange={(event) => navigate({ deploymentModel: event.target.value as AdministrationQuery['deploymentModel'] || undefined, page: 1 })}><option value="">All deployment models</option>{deploymentModelValues.map((value) => <option key={value}>{value}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor="system-lifecycle-filter">Lifecycle state<select className={`${nativeSelectClassName} block w-full`} id="system-lifecycle-filter" value={query.lifecycleState ?? ''} onChange={(event) => navigate({ lifecycleState: event.target.value as AdministrationQuery['lifecycleState'] || undefined, page: 1 })}><option value="">All lifecycle states</option>{lifecycleStateValues.map((value) => <option key={value}>{value}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor="system-internet-filter">Internet-facing<select className={`${nativeSelectClassName} block w-full`} id="system-internet-filter" value={query.internetFacing ?? ''} onChange={(event) => navigate({ internetFacing: event.target.value as AdministrationQuery['internetFacing'] || undefined, page: 1 })}><option value="">Any exposure</option><option value="true">Yes</option><option value="false">No</option></select></label></> : null}
        {kind === 'information-assets' ? <><label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor="asset-classification-filter">Data classification<select className={`${nativeSelectClassName} block w-full`} id="asset-classification-filter" value={query.dataClassification ?? ''} onChange={(event) => navigate({ dataClassification: event.target.value as AdministrationQuery['dataClassification'] || undefined, page: 1 })}><option value="">All classifications</option>{dataClassificationValues.map((value) => <option key={value}>{value}</option>)}</select></label>{([['containsPersonalData', 'Personal data'], ['containsLegalData', 'Legal data'], ['containsCreditCardData', 'Credit-card data']] as const).map(([field, label]) => <label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor={`asset-${field}-filter`} key={field}>{label}<select className={`${nativeSelectClassName} block w-full`} id={`asset-${field}-filter`} value={query[field] ?? ''} onChange={(event) => navigate({ [field]: event.target.value as 'true' | 'false' || undefined, page: 1 })}><option value="">Either</option><option value="true">Yes</option><option value="false">No</option></select></label>)}</> : null}
        </fieldset>
      </form>
      <DataTable
        ariaLabel={`${config.pluralLabel} results`}
        columns={columns}
        data={[...items]}
        densityUserId={densityUserId}
        filters={[...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []), ...(query.framework ? [{ id: 'framework', label: 'Framework', value: query.framework }] : []), ...(query.controlType ? [{ id: 'controlType', label: 'Control type', value: query.controlType }] : []), ...(query.environment ? [{ id: 'environment', label: 'Environment', value: query.environment }] : []), ...(query.deploymentModel ? [{ id: 'deploymentModel', label: 'Deployment model', value: query.deploymentModel }] : []), ...(query.lifecycleState ? [{ id: 'lifecycleState', label: 'Lifecycle', value: query.lifecycleState }] : []), ...(query.internetFacing ? [{ id: 'internetFacing', label: 'Internet-facing', value: query.internetFacing === 'true' ? 'Yes' : 'No' }] : []), ...(query.dataClassification ? [{ id: 'dataClassification', label: 'Classification', value: query.dataClassification }] : []), ...(['containsPersonalData', 'containsLegalData', 'containsCreditCardData'] as const).flatMap((field) => query[field] ? [{ id: field, label: field === 'containsPersonalData' ? 'Personal data' : field === 'containsLegalData' ? 'Legal data' : 'Credit-card data', value: query[field] === 'true' ? 'Yes' : 'No' }] : [])]}
        getRowId={(record) => record.documentId}
        loadingLabel={`Loading ${config.pluralLabel}`}
        onClearFilter={(id) => navigate({ [id]: '', page: 1 })}
        onClearFilters={() => navigate({ q: '', framework: undefined, controlType: undefined, environment: undefined, deploymentModel: undefined, lifecycleState: undefined, internetFacing: undefined, dataClassification: undefined, containsPersonalData: undefined, containsLegalData: undefined, containsCreditCardData: undefined, page: 1 })}
        onPageChange={(page) => navigate({ page })}
        onPageSizeChange={(pageSize) => navigate({ page: 1, pageSize: pageSize as AdministrationQuery['pageSize'] })}
        onSortingChange={(next) => { const first = next[0]; const fallback = config.defaultSort; const sort = (first && sortableFields.includes(first.id) ? `${first.id}:${first.desc ? 'desc' : 'asc'}` : fallback) as AdministrationQuery['sort']; navigate({ page: 1, sort }); }}
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageSizeOptions={administrationPageSizes}
        renderMobileCard={(record) => <article className="space-y-2"><RecordLink className="inline-flex min-h-11 items-center" href={config.detailPath(record.documentId)}>{mobileCardTitle(record)}</RecordLink><p className="line-clamp-3 text-sm">{record.description ?? 'Not provided'}</p><p className="text-sm text-muted-foreground">{'framework' in record ? `${record.framework} · ${record.controlType ?? 'Type not provided'}` : 'systemType' in record ? `${record.systemType ?? 'Type not provided'} · ${record.environment ?? 'Environment not provided'} · Internet-facing: ${yesNo(record.internetFacing)}` : 'dataClassification' in record ? `${record.type ?? 'Type not provided'} · ${record.dataClassification ?? 'Classification not provided'} · Personal: ${yesNo(record.containsPersonalData)}` : `${record.applicableControls?.length ?? 0} applicable controls`}</p>{kind === 'information-systems' ? <p className="text-sm text-muted-foreground">{`Owner: ${systemOwnerLabel(record)} · Business criticality: ${systemCriticalityLabel(record)}`}</p> : null}</article>}
        sorting={sorting}
        state={isPending ? 'loading' : resolvedState}
        stateSlots={{
          empty: emptyState(Boolean(query.q || query.framework || query.controlType || query.environment || query.deploymentModel || query.lifecycleState || query.internetFacing || query.dataClassification || query.containsPersonalData || query.containsLegalData || query.containsCreditCardData), config, () => navigate({ q: '', framework: undefined, controlType: undefined, environment: undefined, deploymentModel: undefined, lifecycleState: undefined, internetFacing: undefined, dataClassification: undefined, containsPersonalData: undefined, containsLegalData: undefined, containsCreditCardData: undefined, page: 1 })),
          error: <ErrorState noun={config.pluralLabel} retry={() => router.refresh()} />,
          // Unreached: a permission state returns the headed denial above, before this table renders.
          permission: <AdministrationAccessDenied kind={kind} />,
        }}
        totalCount={pagination.total}
      />
    </div>
  );
}
