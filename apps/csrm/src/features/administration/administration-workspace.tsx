'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { SortingState } from '@tanstack/react-table';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/csrm/data-table';
import { DetailSection } from '@/components/csrm/detail-section';
import { FormSection } from '@/components/csrm/form-section';
import { nativeSelectClassName } from '@/components/csrm/native-select';
import { PageHeader } from '@/components/csrm/page-header';
import { RecordLink } from '@/components/csrm/record-link';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { OwnerCombobox, type OwnerSearchResult } from '@/features/assessments/owner-combobox';
import type { ActiveUser } from '@/features/assessments/assessment-schema';
import type { AdministrationActionResult, ApplicableControlOption } from './administration-actions';
import { getAdministrationConfig, type AdministrationKind } from './administration-config';
import {
  administrationPageSizes,
  controlCreateInputSchema,
  controlTypeValues,
  dataClassificationValues,
  deploymentModelValues,
  informationAssetCreateInputSchema,
  informationSystemCreateInputSchema,
  lifecycleStateValues,
  riskTypeCreateInputSchema,
  systemEnvironmentValues,
  type AdministrationRecord,
  type AdministrationQuery,
  type ControlCreateInput,
  type ControlAdministrationRecord,
  type InformationAssetAdministrationRecord,
  type InformationAssetCreateInput,
  type InformationSystemAdministrationRecord,
  type InformationSystemCreateInput,
  type RiskTypeAdministrationRecord,
  type RiskTypeCreateInput,
} from './administration-schema';

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
const administrationSearchDelayMs = 700;

export function AdministrationAccessDenied() {
  return <PermissionDeniedState area="Administration records" />;
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

  if (state === 'permission') return <AdministrationAccessDenied />;

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
      cell: (_value, record) => <RecordLink href={config.detailPath(record.documentId)}>{record.name}</RecordLink>,
    },
    { accessorKey: 'description', header: 'Description', cell: (value) => <span className="line-clamp-2">{String(value ?? 'Not provided')}</span> },
    { accessorKey: 'applicableControls', header: 'Applicable controls', numeric: 'magnitude', cell: (value) => Array.isArray(value) ? value.length : 0 },
  ];
  const controlColumns: DataTableColumn<AdministrationWorkspaceRecord>[] = [
    { accessorKey: 'controlNumber', header: 'Control number', enableSorting: true, cell: (_value, record) => <RecordLink href={config.detailPath(record.documentId)}>{'controlNumber' in record ? record.controlNumber : ''}</RecordLink> },
    { accessorKey: 'name', header: 'Name', enableSorting: true, cell: (value) => String(value) },
    { accessorKey: 'framework', header: 'Framework', cell: (value) => String(value) },
    { accessorKey: 'controlType', header: 'Type', cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'controlReference', header: 'Reference', cell: (value) => String(value ?? 'Not provided') },
  ];
  const systemColumns: DataTableColumn<AdministrationWorkspaceRecord>[] = [
    { accessorKey: 'name', header: 'Name', enableSorting: true, cell: (value, record) => <RecordLink href={config.detailPath(record.documentId)}>{String(value)}</RecordLink> },
    { accessorKey: 'systemType', header: 'Type', enableSorting: true, cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'environment', header: 'Environment', enableSorting: true, cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'deploymentModel', header: 'Deployment model', cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'lifecycleState', header: 'Lifecycle', enableSorting: true, cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'internetFacing', header: 'Internet-facing', cell: (value) => yesNo(value) },
  ];
  const assetColumns: DataTableColumn<AdministrationWorkspaceRecord>[] = [
    { accessorKey: 'name', header: 'Name', enableSorting: true, cell: (value, record) => <RecordLink href={config.detailPath(record.documentId)}>{String(value)}</RecordLink> },
    { accessorKey: 'type', header: 'Type', enableSorting: true, cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'dataClassification', header: 'Classification', enableSorting: true, cell: (value) => String(value ?? 'Not provided') },
    { accessorKey: 'location', header: 'Location', cell: (value) => String(value ?? 'Not provided') },
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
        description={kind === 'controls' ? 'Manage reusable Control definitions; implementations remain attached to contextual Risks.' : kind === 'information-systems' ? 'Manage the organisational Information Systems available to assessment workflows.' : kind === 'information-assets' ? 'Manage the organisational Information Assets available to assessment workflows.' : 'Manage reusable Risk Type definitions used to identify contextual Risks in assessments.'}
        title={config.pluralLabel}
        action={<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row-reverse"><Link className={buttonVariants()} href={config.newPath}>Create {config.label}</Link><Link className={buttonVariants({ variant: 'outline' })} href={`${config.listPath}/import`}>Import CSV</Link></div>}
      />
      <form role="search" className="grid max-w-3xl gap-4 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
        <fieldset className="contents" disabled={isPending}>
        <label className="space-y-1 text-sm font-medium text-foreground" htmlFor="administration-search">Search {config.pluralLabel}<Input id="administration-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitSearch(); } }} /></label>
        {kind === 'controls' ? <><label className="space-y-1 text-sm font-medium text-foreground" htmlFor="control-framework">Framework<Input id="control-framework" list="control-framework-suggestions" value={framework} onChange={(event) => setFramework(event.target.value)} /><datalist id="control-framework-suggestions">{frameworkSuggestions.map((value) => <option key={value} value={value} />)}</datalist></label><label className="space-y-1 text-sm font-medium text-foreground" htmlFor="control-type">Control type<select className={`${nativeSelectClassName} block w-full`} id="control-type" value={query.controlType ?? ''} onChange={(event) => navigate({ controlType: event.target.value as AdministrationQuery['controlType'] || undefined, page: 1 })}><option value="">All types</option>{controlTypeValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></> : null}
        {kind === 'information-systems' ? <><label className="space-y-1 text-sm font-medium text-foreground" htmlFor="system-environment-filter">Environment<select className={`${nativeSelectClassName} block w-full`} id="system-environment-filter" value={query.environment ?? ''} onChange={(event) => navigate({ environment: event.target.value as AdministrationQuery['environment'] || undefined, page: 1 })}><option value="">All environments</option>{systemEnvironmentValues.map((value) => <option key={value}>{value}</option>)}</select></label><label className="space-y-1 text-sm font-medium text-foreground" htmlFor="system-deployment-filter">Deployment model<select className={`${nativeSelectClassName} block w-full`} id="system-deployment-filter" value={query.deploymentModel ?? ''} onChange={(event) => navigate({ deploymentModel: event.target.value as AdministrationQuery['deploymentModel'] || undefined, page: 1 })}><option value="">All deployment models</option>{deploymentModelValues.map((value) => <option key={value}>{value}</option>)}</select></label><label className="space-y-1 text-sm font-medium text-foreground" htmlFor="system-lifecycle-filter">Lifecycle state<select className={`${nativeSelectClassName} block w-full`} id="system-lifecycle-filter" value={query.lifecycleState ?? ''} onChange={(event) => navigate({ lifecycleState: event.target.value as AdministrationQuery['lifecycleState'] || undefined, page: 1 })}><option value="">All lifecycle states</option>{lifecycleStateValues.map((value) => <option key={value}>{value}</option>)}</select></label><label className="space-y-1 text-sm font-medium text-foreground" htmlFor="system-internet-filter">Internet-facing<select className={`${nativeSelectClassName} block w-full`} id="system-internet-filter" value={query.internetFacing ?? ''} onChange={(event) => navigate({ internetFacing: event.target.value as AdministrationQuery['internetFacing'] || undefined, page: 1 })}><option value="">Any exposure</option><option value="true">Yes</option><option value="false">No</option></select></label></> : null}
        {kind === 'information-assets' ? <><label className="space-y-1 text-sm font-medium text-foreground" htmlFor="asset-classification-filter">Data classification<select className={`${nativeSelectClassName} block w-full`} id="asset-classification-filter" value={query.dataClassification ?? ''} onChange={(event) => navigate({ dataClassification: event.target.value as AdministrationQuery['dataClassification'] || undefined, page: 1 })}><option value="">All classifications</option>{dataClassificationValues.map((value) => <option key={value}>{value}</option>)}</select></label>{([['containsPersonalData', 'Personal data'], ['containsLegalData', 'Legal data'], ['containsCreditCardData', 'Credit-card data']] as const).map(([field, label]) => <label className="space-y-1 text-sm font-medium text-foreground" htmlFor={`asset-${field}-filter`} key={field}>{label}<select className={`${nativeSelectClassName} block w-full`} id={`asset-${field}-filter`} value={query[field] ?? ''} onChange={(event) => navigate({ [field]: event.target.value as 'true' | 'false' || undefined, page: 1 })}><option value="">Either</option><option value="true">Yes</option><option value="false">No</option></select></label>)}</> : null}
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
        renderMobileCard={(record) => <article className="space-y-2"><RecordLink className="inline-flex min-h-11 items-center" href={config.detailPath(record.documentId)}>{'controlNumber' in record ? `${record.controlNumber} · ${record.name}` : record.name}</RecordLink><p className="line-clamp-3 text-sm">{record.description ?? 'Not provided'}</p><p className="text-sm text-muted-foreground">{'framework' in record ? `${record.framework} · ${record.controlType ?? 'Type not provided'}` : 'systemType' in record ? `${record.systemType ?? 'Type not provided'} · ${record.environment ?? 'Environment not provided'} · Internet-facing: ${yesNo(record.internetFacing)}` : 'dataClassification' in record ? `${record.type ?? 'Type not provided'} · ${record.dataClassification ?? 'Classification not provided'} · Personal: ${yesNo(record.containsPersonalData)}` : `${record.applicableControls?.length ?? 0} applicable controls`}</p></article>}
        sorting={sorting}
        state={isPending ? 'loading' : resolvedState}
        stateSlots={{
          empty: emptyState(Boolean(query.q || query.framework || query.controlType || query.environment || query.deploymentModel || query.lifecycleState || query.internetFacing || query.dataClassification || query.containsPersonalData || query.containsLegalData || query.containsCreditCardData), config, () => navigate({ q: '', framework: undefined, controlType: undefined, environment: undefined, deploymentModel: undefined, lifecycleState: undefined, internetFacing: undefined, dataClassification: undefined, containsPersonalData: undefined, containsLegalData: undefined, containsCreditCardData: undefined, page: 1 })),
          error: <ErrorState noun={config.pluralLabel} retry={() => router.refresh()} />,
          permission: <AdministrationAccessDenied />,
        }}
        totalCount={pagination.total}
      />
    </div>
  );
}

type Action = (input: unknown) => Promise<AdministrationActionResult<AdministrationRecord>>;
type FormValues = Partial<RiskTypeCreateInput & ControlCreateInput & InformationSystemCreateInput & InformationAssetCreateInput> & { name: string; description?: string | null };

export type AdministrationFormProps = {
  kind: AdministrationKind;
  mode: 'create' | 'edit';
  documentId?: string;
  initialValues?: Partial<FormValues>;
  createAction?: Action;
  updateAction?: Action;
  searchControls?: (input: unknown) => Promise<readonly ApplicableControlOption[]>;
  initialControlOptions?: readonly ApplicableControlOption[];
  searchOwners?: (input: { search: string }) => Promise<OwnerSearchResult>;
};

function applyFailure(result: Extract<AdministrationActionResult<AdministrationRecord>, { ok: false }>, form: ReturnType<typeof useForm<FormValues>>, setFormError: (message: string | null) => void) {
  for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
    const message = messages?.[0];
    if (message) form.setError(field as keyof FormValues, { message });
  }
  setFormError(result.formError);
}

export function AdministrationForm({ createAction, documentId, initialControlOptions = [], initialValues, kind, mode, searchControls, searchOwners, updateAction }: AdministrationFormProps) {
  const config = getAdministrationConfig(kind);
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [controlOptions, setControlOptions] = useState<readonly ApplicableControlOption[]>(initialControlOptions);
  const [selectedControlLabels, setSelectedControlLabels] = useState<Record<string, string>>({});
  const [selectedOwner, setSelectedOwner] = useState<ActiveUser | null>(() => typeof initialValues?.owner === 'string' ? { documentId: initialValues.owner, displayName: initialValues.owner } : null);
  const controlSearchRef = useRef<HTMLInputElement>(null);
  const controlOptionsRef = useRef<HTMLDivElement>(null);
  const controlSearchTimerRef = useRef<number | null>(null);
  const controlSearchSequenceRef = useRef(0);
  const normalizedInitial = useMemo<FormValues>(() => kind === 'controls' ? {
    controlNumber: initialValues?.controlNumber ?? '',
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? null,
    controlType: initialValues?.controlType ?? null,
    controlReference: initialValues?.controlReference ?? null,
    framework: initialValues?.framework ?? '',
    frameworkVersion: initialValues?.frameworkVersion ?? null,
    frameworkSource: initialValues?.frameworkSource ?? null,
  } : kind === 'information-systems' ? {
    name: initialValues?.name ?? '', description: initialValues?.description ?? null, systemType: initialValues?.systemType ?? null,
    owner: initialValues?.owner ?? null, environment: initialValues?.environment ?? null, deploymentModel: initialValues?.deploymentModel ?? null,
    businessCriticality: initialValues?.businessCriticality ?? null, internetFacing: initialValues?.internetFacing ?? false,
    externalAccessRequired: initialValues?.externalAccessRequired ?? false, hostingLocation: initialValues?.hostingLocation ?? null,
    lifecycleState: initialValues?.lifecycleState ?? null,
  } : kind === 'information-assets' ? {
    name: initialValues?.name ?? '', description: initialValues?.description ?? null, location: initialValues?.location ?? null, type: initialValues?.type ?? null,
    dataClassification: initialValues?.dataClassification ?? null, confidentialityRating: initialValues?.confidentialityRating ?? null,
    integrityRating: initialValues?.integrityRating ?? null, availabilityRating: initialValues?.availabilityRating ?? null,
    containsPersonalData: initialValues?.containsPersonalData ?? false, containsLegalData: initialValues?.containsLegalData ?? false,
    containsCreditCardData: initialValues?.containsCreditCardData ?? false, comments: initialValues?.comments ?? null,
  } : {
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    applicableControls: [...(initialValues?.applicableControls ?? [])],
  }, [initialValues, kind]);
  const form = useForm<FormValues>({
    defaultValues: normalizedInitial,
    mode: 'onBlur',
    resolver: zodResolver(kind === 'controls' ? controlCreateInputSchema : kind === 'information-systems' ? informationSystemCreateInputSchema : kind === 'information-assets' ? informationAssetCreateInputSchema : riskTypeCreateInputSchema) as never,
  });
  const initial = normalizedInitial;

  function filterInitialControls(search: string): boolean {
    const needle = search.trim().toLocaleLowerCase('en-AU');
    let matched = false;
    controlOptionsRef.current?.querySelectorAll<HTMLElement>('[role="option"]').forEach((option) => {
      const visible = needle.length === 0 || String(option.dataset.label).toLocaleLowerCase('en-AU').includes(needle);
      option.hidden = !visible;
      matched ||= visible;
    });
    if (!matched) {
      controlOptionsRef.current?.querySelectorAll<HTMLElement>('[role="option"]').forEach((option) => { option.hidden = false; });
    }
    return matched;
  }

  async function searchRemoteControls(search = controlSearchRef.current?.value ?? '') {
    if (!searchControls || search.trim().length === 0) return;
    const sequence = ++controlSearchSequenceRef.current;
    const options = await searchControls(search);
    if (sequence === controlSearchSequenceRef.current) setControlOptions(options);
  }

  function handleControlInput(search: string) {
    const sequence = ++controlSearchSequenceRef.current;
    if (filterInitialControls(search) || !searchControls) return;
    if (controlSearchTimerRef.current !== null) window.clearTimeout(controlSearchTimerRef.current);
    controlSearchTimerRef.current = window.setTimeout(async () => {
      const options = await searchControls(search);
      if (sequence === controlSearchSequenceRef.current) setControlOptions(options);
    }, administrationSearchDelayMs);
  }

  async function submit(values: FormValues) {
    setFormError(null);
    let input: unknown = { values };
    let action = createAction;
    if (mode === 'edit') {
      const changed = Object.fromEntries((Object.keys(values) as (keyof FormValues)[])
        .filter((key) => JSON.stringify(values[key]) !== JSON.stringify(initial[key]))
        .map((key) => [key, values[key]]));
      if (Object.keys(changed).length === 0) return;
      input = { documentId, values: changed };
      action = updateAction;
    }
    if (!action) {
      setFormError(`The ${config.label} service is unavailable. Please try again later.`);
      return;
    }
    const result = await action(input);
    if (!result.ok) {
      applyFailure(result, form, setFormError);
      toast.error(result.formError);
      return;
    }
    form.reset(result.data);
    toast.success(mode === 'create' ? `${config.label} created.` : 'Changes saved.');
    router.push(config.detailPath(result.data.documentId));
    router.refresh();
  }

  const returnLink = <Link className={buttonVariants({ variant: 'outline' })} href={config.listPath}>Return to {config.pluralLabel}</Link>;
  const resolvedSearchOwners = searchOwners ?? (async () => ({ ok: true as const, data: [] }));
  return (
    <div className="space-y-8">
      <PageHeader
        description={kind === 'controls' ? 'Manage the reusable Control definition without changing contextual Control Implementations.' : kind === 'information-systems' ? 'Manage this organisational Information System for assessment workflows.' : kind === 'information-assets' ? 'Manage this organisational Information Asset for assessment workflows.' : mode === 'create' ? 'Create a reusable definition for use in future assessments.' : 'Edit this reusable definition without changing existing contextual Risks.'}
        title={mode === 'create' ? `Create ${config.label}` : kind === 'controls' ? `${initial.controlNumber ?? ''} · ${initial.name}` : initial.name || config.label}
      />
      {mode === 'edit' ? <Button type="button" variant="outline" onClick={() => form.setFocus(kind === 'controls' ? 'controlNumber' : 'name')}>Edit {config.label}</Button> : null}
      {formError ? <Alert variant="destructive" role="alert"><AlertTitle>{config.label} could not be saved</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
      <Form {...form}>
        <form className="space-y-8" noValidate onSubmit={form.handleSubmit(submit)}>
          {kind === 'controls' ? <>
          <FormSection title="Identity" description="Identify this reusable Control and its governing framework.">
            <FormField control={form.control} name="controlNumber" render={({ field }) => <FormItem><FormLabel>Control number</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} aria-required="true" /></FormControl><FormDescription>Enter a unique Control number.</FormDescription><FormMessage /></FormItem>} />
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} aria-required="true" /></FormControl><FormDescription>Enter the reusable Control name.</FormDescription><FormMessage /></FormItem>} />
            <FormField control={form.control} name="framework" render={({ field }) => <FormItem><FormLabel>Framework</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} aria-required="true" /></FormControl><FormDescription>Name the source framework.</FormDescription><FormMessage /></FormItem>} />
            <FormField control={form.control} name="frameworkVersion" render={({ field }) => <FormItem><FormLabel>Framework version</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />
          </FormSection>
          <FormSection title="Definition" description="Describe the reusable Control, not a contextual implementation.">
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="controlType" render={({ field }) => <FormItem><FormLabel>Control type</FormLabel><FormControl><select className={`${nativeSelectClassName} w-full`} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)}><option value="">Not provided</option>{controlTypeValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="controlReference" render={({ field }) => <FormItem><FormLabel>Control reference</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="frameworkSource" render={({ field }) => <FormItem><FormLabel>Framework source</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />
          </FormSection></> : kind === 'information-systems' ? <>
          <FormSection title="Identity" description="Identify this organisational Information System.">
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} aria-required="true" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="systemType" render={({ field }) => <FormItem><FormLabel>System type</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />
          </FormSection>
          <FormSection title="Environment" description="Describe deployment and lifecycle facts.">
            <FormField control={form.control} name="environment" render={({ field }) => <FormItem><FormLabel>Environment</FormLabel><FormControl><select aria-label="Environment" className={`${nativeSelectClassName} w-full`} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)}><option value="">Not provided</option>{systemEnvironmentValues.map((value) => <option key={value}>{value}</option>)}</select></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="deploymentModel" render={({ field }) => <FormItem><FormLabel>Deployment model</FormLabel><FormControl><select aria-label="Deployment model" className={`${nativeSelectClassName} w-full`} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)}><option value="">Not provided</option>{deploymentModelValues.map((value) => <option key={value}>{value}</option>)}</select></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="hostingLocation" render={({ field }) => <FormItem><FormLabel>Hosting location</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="lifecycleState" render={({ field }) => <FormItem><FormLabel>Lifecycle state</FormLabel><FormControl><select aria-label="Lifecycle state" className={`${nativeSelectClassName} w-full`} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)}><option value="">Not provided</option>{lifecycleStateValues.map((value) => <option key={value}>{value}</option>)}</select></FormControl><FormMessage /></FormItem>} />
          </FormSection>
          <FormSection title="Exposure and ownership" description="Record criticality, exposure, and an active owner.">
            <FormField control={form.control} name="businessCriticality" render={({ field }) => <FormItem><FormLabel>Business criticality</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="internetFacing" render={({ field }) => <FormItem><FormControl><fieldset className="flex gap-4"><legend className="mb-2 text-sm font-medium">Internet-facing</legend><label><input checked={field.value === true} name="internetFacing" onChange={() => field.onChange(true)} type="radio" /> Yes, internet-facing</label><label><input checked={field.value === false} name="internetFacing" onChange={() => field.onChange(false)} type="radio" /> No, not internet-facing</label></fieldset></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="externalAccessRequired" render={({ field }) => <FormItem><FormControl><fieldset className="flex gap-4"><legend className="mb-2 text-sm font-medium">External access required</legend><label><input checked={field.value === true} name="externalAccessRequired" onChange={() => field.onChange(true)} type="radio" /> Yes</label><label><input checked={field.value === false} name="externalAccessRequired" onChange={() => field.onChange(false)} type="radio" /> No</label></fieldset></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="owner" render={({ field }) => <FormItem><FormControl><OwnerCombobox label="Owner" onValueChange={(owner) => { setSelectedOwner(owner); field.onChange(owner?.documentId ?? null); }} searchOwners={resolvedSearchOwners} value={selectedOwner} /></FormControl><FormMessage /></FormItem>} />
          </FormSection>
          </> : kind === 'information-assets' ? <>
          <FormSection title="Identity" description="Identify this organisational Information Asset.">
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} aria-required="true" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="type" render={({ field }) => <FormItem><FormLabel>Type</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="location" render={({ field }) => <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />
          </FormSection>
          <FormSection title="Classification and assurance" description="Record classification and assurance ratings.">
            <FormField control={form.control} name="dataClassification" render={({ field }) => <FormItem><FormLabel>Data classification</FormLabel><FormControl><select className={`${nativeSelectClassName} w-full`} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)}><option value="">Not provided</option>{dataClassificationValues.map((value) => <option key={value}>{value}</option>)}</select></FormControl><FormMessage /></FormItem>} />
            {(['confidentialityRating', 'integrityRating', 'availabilityRating'] as const).map((fieldName) => <FormField control={form.control} key={fieldName} name={fieldName} render={({ field }) => <FormItem><FormLabel>{fieldName === 'confidentialityRating' ? 'Confidentiality rating' : fieldName === 'integrityRating' ? 'Integrity rating' : 'Availability rating'}</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} />)}
          </FormSection>
          <FormSection title="Data characteristics" description="Identify sensitive data held by this Information Asset.">
            {([['containsPersonalData', 'Contains personal data'], ['containsLegalData', 'Contains legal data'], ['containsCreditCardData', 'Contains credit-card data']] as const).map(([fieldName, label]) => <FormField control={form.control} key={fieldName} name={fieldName} render={({ field }) => <FormItem><FormControl><fieldset className="flex gap-4"><legend className="mb-2 text-sm font-medium">{label}</legend><label><input checked={field.value === true} name={fieldName} onChange={() => field.onChange(true)} type="radio" /> Yes</label><label><input checked={field.value === false} name={fieldName} onChange={() => field.onChange(false)} type="radio" /> No</label></fieldset></FormControl><FormMessage /></FormItem>} />)}
          </FormSection>
          <FormSection title="Notes" description="Record supporting Information Asset notes."><FormField control={form.control} name="comments" render={({ field }) => <FormItem><FormLabel>Comments</FormLabel><FormControl><Textarea {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl><FormMessage /></FormItem>} /></FormSection>
          </> : <>
          <FormSection title="Definition" description="Define the canonical Risk Type used by assessment workflows.">
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} aria-required="true" /></FormControl><FormDescription>Enter a unique Risk Type name.</FormDescription><FormMessage /></FormItem>} />
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value.trim() ? event.target.value : null)} /></FormControl><FormDescription>Explain when this reusable definition applies.</FormDescription><FormMessage /></FormItem>} />
          </FormSection>
          <FormSection title="Applicable Controls" description="Map reusable Controls, not contextual Control Implementations.">
            <FormField control={form.control} name="applicableControls" render={({ field }) => <FormItem><FormLabel>Applicable Controls</FormLabel><FormControl><div className="space-y-3"><div className="flex gap-2"><Input aria-label="Applicable Controls" aria-autocomplete="list" aria-controls={controlOptions.length ? 'applicable-control-options' : undefined} aria-expanded={controlOptions.length > 0} role="combobox" ref={controlSearchRef} onInput={(event) => handleControlInput(event.currentTarget.value)} /><Button type="button" variant="outline" onClick={() => void searchRemoteControls()}>Search Controls</Button></div><p className="sr-only" role="status" aria-live="polite">{controlOptions.length} Control options available.</p>{controlOptions.length ? <div className="rounded-lg border border-border bg-popover p-1" id="applicable-control-options" ref={controlOptionsRef} role="listbox">{controlOptions.filter((option) => !field.value?.includes(option.documentId)).map((option) => <button className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-muted" data-label={option.label} key={option.documentId} onClick={() => { field.onChange([...(field.value ?? []), option.documentId]); setSelectedControlLabels((labels) => ({ ...labels, [option.documentId]: option.label })); if (controlSearchRef.current) controlSearchRef.current.value = ''; }} role="option" type="button">{option.label}</button>)}</div> : null}<fieldset className="rounded-lg border border-border p-4"><legend className="px-1 text-sm font-medium">Selected applicable Controls</legend>{field.value?.length ? field.value.map((controlId) => <label className="flex min-h-11 items-center gap-3 text-sm" key={controlId}><Checkbox checked onCheckedChange={(checked) => { if (!checked) field.onChange(field.value?.filter((id) => id !== controlId)); }} />{selectedControlLabels[controlId] ?? controlId}</label>) : <p className="text-sm text-muted-foreground">No applicable Controls selected.</p>}</fieldset></div></FormControl><FormDescription>Search by Control number or name. These are reusable Controls, not implementations.</FormDescription><FormMessage /></FormItem>} />
          </FormSection>
          </>}
          <div className="flex flex-wrap gap-3">
            <Button disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? mode === 'create' ? 'Creating…' : 'Saving…' : mode === 'create' ? `Create ${config.label}` : 'Save changes'}</Button>
            {form.formState.isDirty ? <ConfirmDialog cancelLabel="Keep editing" confirmLabel="Discard changes" confirmVariant="destructive" description={`Your changes to this ${config.label} have not been saved.`} onConfirm={() => router.push(config.listPath)} pendingLabel="Discarding…" title="Discard unsaved changes?" trigger={returnLink} /> : returnLink}
          </div>
        </form>
      </Form>
      {mode === 'edit' ? <DetailSection title="Downstream use" description={kind === 'controls' ? 'Contextual Control Implementations retain their own assessment history.' : kind === 'risk-types' ? 'Existing contextual Risks retain their own assessment history.' : 'Assessment and Risk references retain their own workflow history.'}><p className="text-sm text-muted-foreground">{kind === 'controls' ? 'This reusable Control may be referenced by Risk Types and contextual Control Implementations. No records are deleted or changed automatically.' : kind === 'risk-types' ? 'Applicable Controls identify reusable relationships only. No records are deleted or changed automatically.' : `This ${config.label} may be referenced by assessment workflows. No records are deleted or changed automatically.`}</p></DetailSection> : null}
    </div>
  );
}
