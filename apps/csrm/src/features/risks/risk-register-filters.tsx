'use client';

import { SlidersHorizontal } from 'lucide-react';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  riskRegisterEffectivenessLabels,
  riskRegisterEffectivenessValues,
  riskRegisterMitigationStatusLabels,
  riskRegisterMitigationStatuses,
  riskRegisterRatingFilterLabel,
  riskRegisterRatingFilterValues,
  riskRegisterStageLabels,
  riskRegisterStages,
  riskRegisterStateDefaultLabel,
  riskRegisterStateLabels,
  riskRegisterStates,
  riskRegisterTreatmentStatusFilterValues,
  riskTreatmentActions,
  riskTreatmentDueStateLabels,
  riskTreatmentDueStates,
  type RiskPickerOption,
} from './risk-domain';
import type { RiskRegisterQuery } from './risk-schema';
import type { RiskRelationSearchResult } from './risk-actions';
import { treatmentStatusFilterLabel } from './risk-register-chips';

export type RiskRegisterPickerOptions = {
  owners: readonly RiskPickerOption[];
  assessments: readonly RiskPickerOption[];
  systems: readonly RiskPickerOption[];
  assets: readonly RiskPickerOption[];
};

type RiskRegisterFiltersProps = {
  activeCount: number;
  disabled: boolean;
  onChange: (changes: Partial<RiskRegisterQuery>) => void;
  pickerOptions: RiskRegisterPickerOptions;
  query: RiskRegisterQuery;
  searchRelations?: (input: { kind: RelationKind; search: string }) => Promise<RiskRelationSearchResult>;
};

type RelationKind = 'owners' | 'assessments' | 'systems' | 'assets';


const selectClassName = 'block h-11 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9';

function RelationCombobox({ kind, label, value, options, disabled, onChange, searchRelations }: {
  kind: RelationKind;
  label: string;
  value?: string;
  options: readonly RiskPickerOption[];
  disabled: boolean;
  onChange: (value: string | undefined) => void;
  searchRelations?: RiskRegisterFiltersProps['searchRelations'];
}) {
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(options);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const sequence = useRef(0);
  const selected = options.find((option) => option.documentId === value) ?? results.find((option) => option.documentId === value);
  useEffect(() => {
    const search = query.trim();
    // A new query starts with no active option, so none that is no longer shown is named or chosen (IN-307).
    setActive(-1);
    if (!search) { setResults(options); setOpen(false); setLoading(false); return; }
    setOpen(true);
    setLoading(true);
    const request = ++sequence.current;
    const timer = window.setTimeout(async () => {
      let response: RiskRelationSearchResult;
      try {
        response = searchRelations
          ? await searchRelations({ kind, search })
          : { ok: true as const, data: options.filter((option) => option.label.toLocaleLowerCase('en-AU').includes(search.toLocaleLowerCase('en-AU'))) };
      } catch {
        // A rejected Server Action ends the search like a refused one, never leaving Searching… on screen.
        response = { ok: false, formError: 'Relation search is unavailable. Try again.' };
      }
      if (request !== sequence.current) return;
      setLoading(false);
      setResults(response.ok ? response.data : []);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [kind, options, query, searchRelations]);
  const activeOption = open && !loading ? results[active] : undefined;

  const choose = (option: RiskPickerOption) => { onChange(option.documentId); setQuery(''); setOpen(false); setActive(-1); };
  return (
    <div className="grid gap-1.5 text-sm font-medium text-foreground">
      <label htmlFor={`${listboxId}-input`}>{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild><input id={`${listboxId}-input`} className={selectClassName} disabled={disabled} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-haspopup="listbox" aria-controls={open && !loading ? listboxId : undefined} aria-activedescendant={activeOption ? `${listboxId}-${active}` : undefined} placeholder={selected?.label ?? 'Search…'} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setActive((index) => Math.min(index + 1, results.length - 1)); }
          if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
          if (event.key === 'Enter' && open && !loading && results[active >= 0 ? active : 0]) { event.preventDefault(); choose(results[active >= 0 ? active : 0]); }
          if (event.key === 'Escape') setOpen(false);
        }} /></PopoverAnchor>
        {/* A listbox popup (ARIA APG combobox): focus stays in the input, so the Popover only positions it and carries no dialog role. */}
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-1" onOpenAutoFocus={(event) => event.preventDefault()} role={undefined}>
          {loading ? <p className="p-2 text-muted-foreground" role="status">Searching…</p> : null}
          {!loading && results.length === 0 ? <p className="p-2 text-muted-foreground" role="status">No matching options.</p> : null}
          {!loading ? <div id={listboxId} role="listbox" aria-label={`${label} results`}>{results.map((option, index) => <button id={`${listboxId}-${index}`} role="option" aria-selected={option.documentId === value} className="block w-full rounded-md px-2 py-2 text-left hover:bg-muted" key={option.documentId} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>{option.label}</button>)}</div> : null}
        </PopoverContent>
      </Popover>
      {selected ? <div className="flex items-center justify-between gap-2 font-normal"><span>{selected.label}</span><button className="text-primary" type="button" onClick={() => onChange(undefined)}>Clear</button></div> : null}
    </div>
  );
}

function MoreFilterFields({ disabled, onChange, pickerOptions, query, searchRelations }: Omit<RiskRegisterFiltersProps, 'activeCount'>) {
  return (
    <div className="grid gap-3">
      <RelationCombobox kind="owners" label="Risk owner" value={query.riskOwner} options={pickerOptions.owners} disabled={disabled} searchRelations={searchRelations} onChange={(riskOwner) => onChange({ riskOwner })} />
      <RelationCombobox kind="owners" label="Treatment owner" value={query.treatmentOwner} options={pickerOptions.owners} disabled={disabled} searchRelations={searchRelations} onChange={(treatmentOwner) => onChange({ treatmentOwner })} />
      <RelationCombobox kind="assessments" label="Related assessment" value={query.assessment} options={pickerOptions.assessments} disabled={disabled} searchRelations={searchRelations} onChange={(assessment) => onChange({ assessment })} />
      <div className="grid gap-1">
        {/* Choosing a system clears No impacted system, and the reverse: the two never travel together (D-35). */}
        <RelationCombobox kind="systems" label="Impacted system" value={query.system} options={pickerOptions.systems} disabled={disabled} searchRelations={searchRelations} onChange={(system) => onChange({ system, impactedSystem: undefined })} />
        <label className="flex min-h-11 items-center gap-2 text-sm text-foreground md:min-h-9">
          <Checkbox checked={query.impactedSystem === 'none'} disabled={disabled} onCheckedChange={(checked) => onChange(checked === true ? { impactedSystem: 'none', system: undefined } : { impactedSystem: undefined })} />
          No impacted system
        </label>
      </div>
      <RelationCombobox kind="assets" label="Impacted asset" value={query.asset} options={pickerOptions.assets} disabled={disabled} searchRelations={searchRelations} onChange={(asset) => onChange({ asset })} />
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        Mitigation-control status
        <select aria-label="Mitigation-control status" className={selectClassName} disabled={disabled} value={query.mitigationStatus ?? ''} onChange={(event) => onChange({ mitigationStatus: event.target.value ? event.target.value as RiskRegisterQuery['mitigationStatus'] : undefined })}>
          <option value="">All</option>
          {riskRegisterMitigationStatuses.map((status) => <option key={status} value={status}>{riskRegisterMitigationStatusLabels[status]}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        Risk state
        <select aria-label="Risk state" className={selectClassName} disabled={disabled} value={query.state ?? ''} onChange={(event) => onChange({ state: event.target.value ? event.target.value as RiskRegisterQuery['state'] : undefined })}>
          <option value="">{riskRegisterStateDefaultLabel}</option>
          {riskRegisterStates.map((state) => <option key={state} value={state}>{riskRegisterStateLabels[state]}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        Stage
        <select aria-label="Stage" className={selectClassName} disabled={disabled} value={query.stage ?? ''} onChange={(event) => onChange({ stage: event.target.value ? event.target.value as RiskRegisterQuery['stage'] : undefined })}>
          <option value="">All</option>
          {riskRegisterStages.map((stage) => <option key={stage} value={stage}>{riskRegisterStageLabels[stage]}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        Treatment action
        <select aria-label="Treatment action" className={selectClassName} disabled={disabled} value={query.treatmentAction ?? ''} onChange={(event) => onChange({ treatmentAction: event.target.value ? event.target.value as RiskRegisterQuery['treatmentAction'] : undefined })}>
          <option value="">All</option>
          {riskTreatmentActions.map((action) => <option key={action} value={action}>{action}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        Due state
        <select aria-label="Due state" className={selectClassName} disabled={disabled} value={query.dueState ?? ''} onChange={(event) => onChange({ dueState: event.target.value ? event.target.value as RiskRegisterQuery['dueState'] : undefined })}>
          <option value="">All</option>
          {riskTreatmentDueStates.map((dueState) => <option key={dueState} value={dueState}>{riskTreatmentDueStateLabels[dueState]}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        Mitigation-control effectiveness
        <select aria-label="Mitigation-control effectiveness" className={selectClassName} disabled={disabled} value={query.mitigationEffectiveness ?? ''} onChange={(event) => onChange({ mitigationEffectiveness: event.target.value ? event.target.value as RiskRegisterQuery['mitigationEffectiveness'] : undefined })}>
          <option value="">All</option>
          {riskRegisterEffectivenessValues.map((rating) => <option key={rating} value={rating}>{riskRegisterEffectivenessLabels[rating]}</option>)}
        </select>
      </label>
      <fieldset className="grid gap-2 border-0 p-0">
        <legend className="text-sm font-medium text-foreground">Target date range</legend>
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Target date from
          <Input className="h-11 tabular-nums" disabled={disabled} type="date" value={query.targetDateFrom ?? ''} onChange={(event) => onChange({ targetDateFrom: event.target.value || undefined })} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Target date to
          <Input className="h-11 tabular-nums" disabled={disabled} type="date" value={query.targetDateTo ?? ''} onChange={(event) => onChange({ targetDateTo: event.target.value || undefined })} />
        </label>
        <Button className="min-h-11 justify-start px-0" disabled={disabled || (!query.targetDateFrom && !query.targetDateTo)} type="button" variant="link" onClick={() => onChange({ targetDateFrom: undefined, targetDateTo: undefined })}>
          Clear target dates
        </Button>
      </fieldset>
    </div>
  );
}

function CoreFilterFields({ disabled, labelClassName, onChange, query }: Pick<RiskRegisterFiltersProps, 'disabled' | 'onChange' | 'query'> & {
  /** Extra label classes: the desktop row keeps each label on one line. */
  labelClassName?: string;
}) {
  const labelClass = cn('grid gap-1.5 text-sm font-medium text-foreground', labelClassName);
  return (
    <>
      <label className={labelClass}>
        Treatment status
        <select aria-label="Treatment status" className={selectClassName} disabled={disabled} value={query.treatmentStatus ?? ''} onChange={(event) => onChange({ treatmentStatus: event.target.value ? event.target.value as RiskRegisterQuery['treatmentStatus'] : undefined })}>
          <option value="">All</option>
          {riskRegisterTreatmentStatusFilterValues.map((status) => <option key={status} value={status}>{treatmentStatusFilterLabel(status)}</option>)}
        </select>
      </label>
      <label className={labelClass}>
        Inherent rating
        <select aria-label="Inherent rating" className={selectClassName} disabled={disabled} value={query.inherentRating ?? ''} onChange={(event) => onChange({ inherentRating: event.target.value ? event.target.value as RiskRegisterQuery['inherentRating'] : undefined })}>
          <option value="">All</option>
          {riskRegisterRatingFilterValues.map((rating) => <option key={rating} value={rating}>{riskRegisterRatingFilterLabel(rating)}</option>)}
        </select>
      </label>
      <label className={labelClass}>
        Residual rating
        <select aria-label="Residual rating" className={selectClassName} disabled={disabled} value={query.residualRating ?? ''} onChange={(event) => onChange({ residualRating: event.target.value ? event.target.value as RiskRegisterQuery['residualRating'] : undefined })}>
          <option value="">All</option>
          {riskRegisterRatingFilterValues.map((rating) => <option key={rating} value={rating}>{riskRegisterRatingFilterLabel(rating)}</option>)}
        </select>
      </label>
    </>
  );
}

export function RiskRegisterFilters({ activeCount, disabled, onChange, pickerOptions, query, searchRelations }: RiskRegisterFiltersProps) {
  const moreFiltersTitleId = useId();
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q');
    onChange({ q: typeof value === 'string' ? value.trim() : '' });
  };

  return (
    // The filter controls do not print; the table's chips and result count carry the active filters (X-4).
    <div className="space-y-3" data-print="hidden">
      {/*
        The sidebar makes the content narrower at lg than at md, so from md to lg the search form
        takes the whole first row and the three selects share the next; from xl the four sit in one
        row with the search in the widest track (UI-SPEC section 4.1). Labels never wrap.
      */}
      <div className="hidden gap-3 md:grid md:grid-cols-3 xl:grid-cols-[2fr_1fr_1fr_1fr]">
        <form className="flex gap-2 md:col-span-3 xl:col-span-1" role="search" onSubmit={submitSearch}>
          <label className="grid flex-1 gap-1.5 whitespace-nowrap text-sm font-medium text-foreground">
            Search Risks
            {/* Block, so the nowrap label text cannot pull the input onto its line and under the button. */}
            <Input aria-label="Search Risks" className="block h-9" defaultValue={query.q} disabled={disabled} key={query.q} name="q" type="search" />
          </label>
          <Button className="self-end" disabled={disabled} type="submit">Search Risks</Button>
        </form>
        <CoreFilterFields disabled={disabled} labelClassName="whitespace-nowrap" onChange={onChange} query={query} />
      </div>

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild><Button className="hidden md:inline-flex" disabled={disabled} type="button" variant="outline"><SlidersHorizontal aria-hidden="true" />More filters</Button></PopoverTrigger>
          {/* More filters takes focus into its fields, so it is a dialog, named by its title. */}
          <PopoverContent align="start" aria-labelledby={moreFiltersTitleId} className="max-h-[var(--radix-popover-content-available-height)] w-80 overflow-y-auto">
            <PopoverTitle className="mb-3" id={moreFiltersTitleId}>More filters</PopoverTitle>
            <MoreFilterFields disabled={disabled} onChange={onChange} pickerOptions={pickerOptions} query={query} searchRelations={searchRelations} />
          </PopoverContent>
        </Popover>
        <Sheet>
          <SheetTrigger asChild><Button className="md:hidden" disabled={disabled} type="button" variant="outline"><SlidersHorizontal aria-hidden="true" />Filters ({activeCount})</Button></SheetTrigger>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md" side="right">
            <SheetHeader><SheetTitle>Risk register filters</SheetTitle><SheetDescription>Search and filter Risks.</SheetDescription></SheetHeader>
            <div className="space-y-4 px-4 pb-6">
              <form className="grid gap-2" role="search" onSubmit={submitSearch}>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">Search Risks<Input aria-label="Search Risks" defaultValue={query.q} disabled={disabled} key={query.q} name="q" type="search" /></label>
                <Button className="w-full" disabled={disabled} type="submit">Search Risks</Button>
              </form>
              <CoreFilterFields disabled={disabled} onChange={onChange} query={query} />
              <MoreFilterFields disabled={disabled} onChange={onChange} pickerOptions={pickerOptions} query={query} searchRelations={searchRelations} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
