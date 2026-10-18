'use client';

import { AlertCircleIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import {
  RelationPicker,
  type RelationPickerItem,
  type RelationPickerSearchInput,
  type RelationPickerSearchResult,
} from '@/components/csrm/relation-picker';
import { useLeaveGuard } from '@/components/csrm/navigation-guard';
import { SaveStatus } from '@/components/csrm/save-status';
import { AiFieldMarker } from '@/features/ai-assistance/ai-field-marker';
import { AiCitations } from '@/features/ai-assistance/ai-citations';
import { AiReviewBar } from '@/features/ai-assistance/ai-review-bar';
import { AiUncitedClaims } from '@/features/ai-assistance/ai-uncited-claims';
import { fieldMarkerState, prefillNote, treatmentActionNote, withFieldStates } from '@/features/ai-assistance/ai-assistance-domain';
import { useAiDecisions } from '@/features/ai-assistance/use-ai-decisions';
import { newRiskLeaveCopy } from '@/features/risk-curation/risk-curation-domain';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createRiskAction, updateRiskAction } from './assessment-actions';
import { useRecordSaveStatus } from './use-record-save-status';
import { OwnerCombobox, type OwnerSearchInput, type OwnerSearchResult } from './owner-combobox';
import {
  changedWritableValues,
  exemptionReviewDateFormValue,
  inventoryPickerPageSize,
  requestRelationGroup,
  riskWritableFields,
  selectedRelationItem,
  withExemptionReviewInstant,
} from './assessment-domain';
import type {
  ActiveUser,
  AiFieldReview,
  AnalystRisk,
  RiskAiProvenance,
  RiskWithdrawal,
  Risk,
  RiskType,
  RiskUpdateInput,
} from './assessment-schema';

export type AssessmentRelationOption = { documentId: string; name: string };
/** A Risk the editor holds: the analyst read's AI facts and, from Phase 16 (D-08), its withdrawal facts (null while active). */
export type EditableRisk = AnalystRisk & { aiProvenance?: RiskAiProvenance | null; withdrawal?: RiskWithdrawal | null };

export type RelationSearch = (input: RelationPickerSearchInput) => Promise<RelationPickerSearchResult>;

/** Phase 16 D-17 (16-UI-SPEC §7): what a discarded new Risk held, so Undo reopens the form with it. Nothing is sent. */
export type NewRiskDraft = { readonly values: RiskUpdateInput; readonly owners: readonly ActiveUser[] };

export type RiskEditorOptions = {
  riskTypes: readonly RiskType[];
  users: readonly ActiveUser[];
  /** The originating request's selected systems and assets, offered first in their pickers (D-30). */
  requestSystems: readonly AssessmentRelationOption[];
  requestAssets: readonly AssessmentRelationOption[];
  /** Served names of the systems and assets the Risks already hold, keyed by id (D-30). */
  relationLabels: Readonly<Record<string, string>>;
  /** Search the whole inventory, one bounded page at a time (D-28); the page passes the Server Actions. */
  searchSystems: RelationSearch;
  searchAssets: RelationSearch;
};

type RelationField = 'informationSystemImpacted' | 'informationAssetImpacted';

export type RiskEditorProps = {
  assessmentId: string;
  mode: 'create' | 'edit';
  options: RiskEditorOptions;
  risk?: EditableRisk;
  searchOwners: (input: OwnerSearchInput) => Promise<OwnerSearchResult>;
  onCreated?: (risk: EditableRisk) => void;
  /** The saved Risk, and the fields the save changed: Strapi marks an AI-written one among them `edited` (D-21). */
  onUpdated?: (risk: EditableRisk, changedFields: readonly string[]) => void;
  /** Tells the page the name of a record chosen by search, so a remounted editor keeps it (D-30). */
  onRelationChosen?: (item: RelationPickerItem) => void;
  /** When this Risk was just added, so its new card confirms `Risk added at {time}` (UI-SPEC §13.4). */
  addedAt?: string;
  onDecision?: () => Promise<void>;
  /** FE3-05 (16-UI-SPEC §6.5): a save refused because the Risk was withdrawn meanwhile, so the page reads it again. */
  onRiskWithdrawn?: () => void;
  /** WR-302: applies a decision Strapi accepted to the page's copy of this Risk, before the read that follows. */
  onReviewed?: (names: readonly string[], state: AiFieldReview['state']) => void;
  /** The originating request, whose answers and fields the AI's citations open (12-UI-SPEC §4). */
  requestId?: string;
  /**
   * Phase 16 (16-UI-SPEC §4.2, §6.1; UI-D8, UI-D17): told whether the form holds changes not yet saved, so the card's
   * withdraw form waits for them and its `AI rewrite` withholds Confirm.
   */
  onUnsavedChange?: (unsaved: boolean) => void;
  /**
   * Phase 16 D-17 (16-UI-SPEC §7): create mode offers `Discard new risk`, which hands back what the form holds, or null
   * when it holds nothing; the page closes the form and offers Undo. Nothing is sent.
   */
  onDiscard?: (draft: NewRiskDraft | null) => void;
  /** Create mode: the values a discarded new Risk held, restored by Undo. */
  draft?: NewRiskDraft;
  /** Create mode: focus the first field once the form opens (Undo of a discard). */
  focusFirstField?: boolean;
};

const noFieldReviews: readonly AiFieldReview[] = [];

const emptyRiskValues: RiskUpdateInput = {
  issueStatement: null,
  riskStatement: null,
  riskCategory: null,
  riskSubCategory: null,
  riskCause: null,
  potentialImpact: null,
  riskType: null,
  riskOwner: null,
  informationSystemImpacted: null,
  informationAssetImpacted: null,
  dataClassification: null,
  inherentLikelihood: null,
  highestInherentConsequence: null,
  inherentRating: null,
  inherentRatingRationale: null,
  residualLikelihood: null,
  highestResidualConsequence: null,
  residualRating: null,
  residualRatingRationale: null,
  controlEffectiveness: null,
  riskVelocity: null,
  identifiedDate: null,
  targetDate: null,
  closureDate: null,
  isExempted: null,
  exemptionReviewDate: null,
  escalationDetails: null,
  comments: null,
  riskCommunicationDate: null,
  treatmentAction: null,
  treatmentPlan: null,
  treatmentOwner: null,
  treatmentResolveDate: null,
  treatmentStatus: null,
};

const textFields = [
  ['issueStatement', 'Issue statement', true],
  ['riskStatement', 'Risk statement', true],
  ['riskCategory', 'Risk category', false],
  ['riskSubCategory', 'Risk sub-category', false],
  ['riskCause', 'Risk cause', true],
  ['potentialImpact', 'Potential impact', true],
  ['inherentLikelihood', 'Inherent likelihood', false],
  ['highestInherentConsequence', 'Highest inherent consequence', false],
  ['inherentRatingRationale', 'Inherent rating rationale', true],
  ['residualLikelihood', 'Residual likelihood', false],
  ['highestResidualConsequence', 'Highest residual consequence', false],
  ['residualRatingRationale', 'Residual rating rationale', true],
  ['escalationDetails', 'Escalation details', true],
  ['comments', 'Comments', true],
  ['treatmentPlan', 'Treatment plan', true],
] as const;

const dateFields = [
  ['identifiedDate', 'Identified date'],
  ['targetDate', 'Target date'],
  ['closureDate', 'Closure date'],
  ['riskCommunicationDate', 'Risk communication date'],
  ['treatmentResolveDate', 'Treatment resolve date'],
] as const;

const choiceFields = [
  ['dataClassification', 'Data classification', ['Public', 'Internal', 'Restricted', 'Critical Infrastructure Sensitive']],
  ['inherentRating', 'Inherent rating', ['Low', 'Moderate', 'High', 'Critical']],
  ['residualRating', 'Residual rating', ['Low', 'Moderate', 'High', 'Critical']],
  ['controlEffectiveness', 'Control effectiveness', ['Effective', 'Partially Effective', 'Ineffective', 'Not Assessed']],
  ['riskVelocity', 'Risk velocity', ['Low', 'Moderate', 'High', 'Very High']],
  ['treatmentAction', 'Treatment action', ['Accept', 'Treat']],
  ['treatmentStatus', 'Treatment status', ['Not Started', 'In Progress', 'Overdue', 'Complete']],
] as const;

function selectedValues(risk?: EditableRisk): RiskUpdateInput {
  if (!risk) return emptyRiskValues;
  const values = Object.fromEntries(riskWritableFields.map((field) => [field, risk[field] ?? null])) as RiskUpdateInput;
  // The date field holds the stored instant's UTC date, so an untouched legacy value compares unchanged (D-32).
  return { ...values, exemptionReviewDate: exemptionReviewDateFormValue(risk.exemptionReviewDate) || null };
}

function normalizeEmptyValues(values: RiskUpdateInput): RiskUpdateInput {
  return Object.fromEntries(
    riskWritableFields.map((field) => [field, values[field] === '' ? null : values[field]]),
  ) as RiskUpdateInput;
}

/* §7 (D-17): a new Risk's form holds input once any field Save would send has a value. */
function holdsInput(values: RiskUpdateInput): boolean {
  const held = normalizeEmptyValues(values);
  return riskWritableFields.some((field) => held[field] !== null && held[field] !== undefined);
}

export function RiskEditor({ addedAt, assessmentId, draft, focusFirstField = false, mode, onCreated, onDecision, onDiscard, onRelationChosen, onReviewed, onRiskWithdrawn, onUnsavedChange, onUpdated, options, requestId, risk, searchOwners }: RiskEditorProps) {
  const [formError, setFormError] = useState<string | null>(null);
  /*
   * The Risk as last saved is what the next save compares with (CR-201): each accepted save updates it from
   * what was sent and what Strapi answered, and a newer Risk from the page replaces it. The page-load Risk never
   * stays the baseline, so a field set back to its page-load value after a save is a change and is sent.
   */
  const [savedRisk, setSavedRisk] = useState(risk);
  const [pageRisk, setPageRisk] = useState(risk);
  if (risk !== pageRisk) {
    setPageRisk(risk);
    setSavedRisk(risk);
  }
  const initial = savedRisk || mode === 'edit' ? selectedValues(savedRisk) : draft?.values ?? emptyRiskValues;
  const form = useForm<RiskUpdateInput>({ defaultValues: initial });
  const { clearErrors, formState, handleSubmit, register, setError, setValue, watch } = form;
  const formRef = useRef<HTMLFormElement>(null);
  /*
   * WR-302: the AI facts are the saved Risk's. A decision Strapi accepted, or an AI field a save changed (D-21), holds
   * here as soon as Strapi answers and stays when the read that follows fails; a newer Risk from the page replaces it.
   */
  const savedProvenance = savedRisk?.aiProvenance ?? null;
  const decisions = useAiDecisions({
    assessmentId,
    target: { kind: 'risk', riskId: risk?.documentId ?? '' },
    fields: savedProvenance?.fields ?? noFieldReviews,
    place: `on ${risk?.riskNumber ?? 'this Risk'}`,
    formRef,
    onUpdated: onDecision ?? (async () => {}),
    onReviewed: (names, state) => {
      setSavedRisk((current) => (current?.aiProvenance ? { ...current, aiProvenance: withFieldStates(current.aiProvenance, names, state) } : current));
      onReviewed?.(names, state);
    },
  });
  const provenance = savedProvenance ? { ...savedProvenance, fields: decisions.fields } : null;
  const values = watch();
  const changedFields = new Set(provenance?.fields.filter((fact) => fieldMarkerState(fact, values[fact.field as keyof RiskUpdateInput], initial[fact.field as keyof RiskUpdateInput]) === 'changed').map((fact) => fact.field) ?? []);
  const markerState = (name: keyof RiskUpdateInput) => fieldMarkerState(provenance?.fields.find((fact) => fact.field === name), values[name], initial[name]);
  const markerId = (name: keyof RiskUpdateInput) => `risk-${risk?.documentId ?? 'new'}-${name}-ai-marker`;
  /* 12-UI-SPEC §3.4 and §3.5: the notes a proposed pre-filled value or treatment action carries under its field. */
  const notes: Partial<Record<keyof RiskUpdateInput, string | null>> = {
    riskType: prefillNote('riskType', markerState('riskType') === 'proposed', values.riskType),
    dataClassification: prefillNote('dataClassification', markerState('dataClassification') === 'proposed', values.dataClassification, options.relationLabels[risk?.informationAssetImpacted ?? ''] ?? options.requestAssets.find((item) => item.documentId === risk?.informationAssetImpacted)?.name),
    treatmentAction: treatmentActionNote(markerState('treatmentAction') === 'proposed', values.treatmentAction, values.residualRating, provenance?.adjustments ?? []),
  };
  const noteId = (name: keyof RiskUpdateInput) => `risk-${risk?.documentId ?? 'new'}-${name}-note`;
  /* The field's description: its marker, then its note (walk D13(c)), then its error. */
  const describedBy = (name: keyof RiskUpdateInput, error?: string) => [
    provenance?.fields.some((fact) => fact.field === name) ? markerId(name) : null,
    notes[name] ? noteId(name) : null,
    error ? `${name}-error` : null,
  ].filter(Boolean).join(' ') || undefined;
  const citations = (name: keyof RiskUpdateInput, label: string) => {
    const sources = provenance?.fields.find((fact) => fact.field === name)?.sources;
    return sources ? <AiCitations fieldLabel={label} requestId={requestId ?? ''} sources={sources} /> : null;
  };
  const marker = (name: keyof RiskUpdateInput, label: string) => <AiFieldMarker field={name} id={markerId(name)} label={label} onConfirm={() => decisions.confirm(name)} pending={decisions.pendingFields.has(name)} state={markerState(name)} />;
  const confirmation = useRecordSaveStatus(watch, addedAt);
  /* Unsaved: a field differs from the Risk as last saved, as Save risk would send it. */
  const unsaved = mode === 'edit' && Object.keys(changedWritableValues(riskWritableFields, normalizeEmptyValues(values), initial)).length > 0;
  useEffect(() => {
    onUnsavedChange?.(unsaved);
  }, [unsaved]);
  /* §7 (D-17, amended 2026-10-16): Phase 10's leave guard asks before leaving a new Risk's typed values, kept nowhere else. */
  useLeaveGuard(mode === 'create' && holdsInput(values), 'waiting', newRiskLeaveCopy);
  const systemErrorId = useId();
  const assetErrorId = useId();
  // The chosen system and asset keep their names when they are not on the current search page (D-30).
  const [selectedSystem, setSelectedSystem] = useState<RelationPickerItem | null>(() => selectedRelationItem(risk?.informationSystemImpacted ?? draft?.values.informationSystemImpacted, options.requestSystems, options.relationLabels));
  const [selectedAsset, setSelectedAsset] = useState<RelationPickerItem | null>(() => selectedRelationItem(risk?.informationAssetImpacted ?? draft?.values.informationAssetImpacted, options.requestAssets, options.relationLabels));
  const chooseRelation = (field: RelationField, item: RelationPickerItem | null) => {
    if (field === 'informationSystemImpacted') setSelectedSystem(item);
    else setSelectedAsset(item);
    setValue(field, item?.documentId ?? null, { shouldDirty: true });
    clearErrors(field);
    if (item) onRelationChosen?.(item);
  };
  const [selectedOwners, setSelectedOwners] = useState<Record<string, ActiveUser>>(() => Object.fromEntries([...options.users, ...(draft?.owners ?? [])].map((owner) => [owner.documentId, owner])));
  useEffect(() => {
    setSelectedOwners((current) => ({ ...Object.fromEntries(options.users.map((owner) => [owner.documentId, owner])), ...current }));
  }, [options.users]);
  const selectedRiskOwner = selectedOwners[watch('riskOwner') ?? ''] ?? null;
  const selectedTreatmentOwner = selectedOwners[watch('treatmentOwner') ?? ''] ?? null;
  const chooseOwner = (field: 'riskOwner' | 'treatmentOwner', owner: ActiveUser | null) => {
    if (owner) setSelectedOwners((current) => ({ ...current, [owner.documentId]: owner }));
    setValue(field, owner?.documentId ?? null, { shouldDirty: true });
  };

  /*
   * 16-UI-SPEC §5.2 (12 §6): a newer Risk from the page, such as one an AI change confirmed, updates the fields the analyst
   * has not changed, in place and without a remount; a field holding an unsaved value keeps it (D-36, no lost input).
   * Without this the form would still show, and the next save would send back, the value the Risk held before.
   */
  const baseline = useRef(initial);
  useEffect(() => {
    const previous = baseline.current;
    const next = selectedValues(savedRisk);
    baseline.current = next;
    if (mode !== 'edit') return;
    const current = normalizeEmptyValues(form.getValues());
    for (const field of riskWritableFields) {
      if (Object.is(next[field], previous[field]) || !Object.is(current[field], previous[field])) continue;
      setValue(field, next[field] as never);
      if (field === 'informationSystemImpacted') setSelectedSystem(selectedRelationItem(next[field], options.requestSystems, options.relationLabels));
      if (field === 'informationAssetImpacted') setSelectedAsset(selectedRelationItem(next[field], options.requestAssets, options.relationLabels));
    }
  }, [savedRisk]);

  /* §7 (UI-D28): an Undo of a discard reopens the form with focus in its first field. */
  useEffect(() => {
    if (focusFirstField) formRef.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
  }, []);

  /* §7: the form closes at once; what it holds goes back to the page for Undo, and an untouched form closes silently. */
  function discard() {
    const held = normalizeEmptyValues(form.getValues());
    const typed = holdsInput(held);
    const owners = Object.values(selectedOwners).filter((owner) => owner.documentId === held.riskOwner || owner.documentId === held.treatmentOwner);
    onDiscard?.(typed ? { values: held, owners } : null);
  }

  async function submit(values: RiskUpdateInput) {
    setFormError(null);
    confirmation.clear();
    const formValues = normalizeEmptyValues(values);
    const normalized = withExemptionReviewInstant(formValues);
    const submitted = mode === 'create' ? normalized : withExemptionReviewInstant(changedWritableValues(riskWritableFields, formValues, initial));
    if (mode === 'edit' && Object.keys(submitted).length === 0) {
      confirmation.note('No changes to save.');
      return;
    }
    const result = mode === 'create'
      ? await createRiskAction({ assessmentId, values: submitted })
      : await updateRiskAction({ assessmentId, riskId: risk?.documentId, values: submitted });

    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages?.[0];
        if (message && riskWritableFields.includes(field as keyof RiskUpdateInput)) {
          setError(field as keyof RiskUpdateInput, { message });
        }
      }
      setFormError(result.formError);
      if (result.reason === 'RISK_WITHDRAWN') onRiskWithdrawn?.();
      return;
    }
    // Confirmed only after an ok result, so a save that did not persist never reads as saved (T-10-54).
    if (mode === 'create') onCreated?.({ ...normalized, ...result.data } as EditableRisk);
    else {
      // Strapi answers with the Risk summary (riskSchema); the fields it does not serve hold what was just saved.
      const { riskNumber, riskStatement, inherentRating, residualRating } = result.data;
      const saved = { ...savedRisk, ...submitted, riskNumber, riskStatement, inherentRating, residualRating } as EditableRisk;
      // D-21 (WR-302): Strapi marked each AI field this save changed `edited`, in the AI facts it holds now.
      const changedFields = Object.keys(submitted);
      setSavedRisk((current) => ({ ...saved, aiProvenance: current?.aiProvenance ? withFieldStates(current.aiProvenance, changedFields, 'edited') : current?.aiProvenance }));
      confirmation.saved();
      onUpdated?.(saved, changedFields);
    }
  }

  return (
    <form className="grid min-w-0 gap-6" noValidate onSubmit={handleSubmit(submit)} ref={formRef}>
      <AiReviewBar changedFields={changedFields} onConfirmRemaining={decisions.confirmRemaining} pending={decisions.isPending} place={{ kind: 'risk', number: risk?.riskNumber ?? '' }} provenance={provenance} />
      {provenance ? <AiUncitedClaims claims={provenance.uncitedClaims} reviewOutstanding={provenance.fields.some((fact) => fact.state === 'proposed')} riskNumber={risk?.riskNumber ?? ''} /> : null}
      {formError ? <Alert variant="destructive"><AlertTitle>Risk not saved</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
      <div className="grid gap-5 md:grid-cols-2">
        {textFields.map(([name, label, multiline]) => (
          <div className={multiline ? 'grid gap-2 md:col-span-2' : 'grid gap-2'} key={name}>
            <div className="flex flex-wrap items-center gap-2"><label className="text-sm font-medium" htmlFor={`risk-${risk?.documentId ?? 'new'}-${name}`}>{label}</label>{marker(name, label)}</div>
            {multiline
              ? <Textarea aria-describedby={describedBy(name, formState.errors[name]?.message)} aria-invalid={Boolean(formState.errors[name])} id={`risk-${risk?.documentId ?? 'new'}-${name}`} {...register(name)} />
              : <Input aria-describedby={describedBy(name, formState.errors[name]?.message)} aria-invalid={Boolean(formState.errors[name])} id={`risk-${risk?.documentId ?? 'new'}-${name}`} {...register(name)} />}
            <FieldError id={`${name}-error`} message={formState.errors[name]?.message} />
            {citations(name, label)}
          </div>
        ))}
        <div className="grid gap-1"><SelectField idPrefix={`risk-${risk?.documentId ?? 'new'}`} describedBy={describedBy('riskType', formState.errors.riskType?.message)} error={formState.errors.riskType?.message} label="Risk type" marker={marker('riskType', 'Risk type')} name="riskType" options={options.riskTypes.map((item) => ({ value: item.documentId, label: item.name }))} register={register} /><FieldHint id={noteId('riskType')} text={notes.riskType ?? null} /></div>
        <div><OwnerCombobox errorId="riskOwner-error" invalid={Boolean(formState.errors.riskOwner)} label="Risk owner" onValueChange={(owner) => chooseOwner('riskOwner', owner)} searchOwners={searchOwners} value={selectedRiskOwner} /><FieldError id="riskOwner-error" message={formState.errors.riskOwner?.message} /></div>
        <div className="grid min-w-0 gap-2">
          <RelationPicker
            descriptionId={provenance?.fields.some((fact) => fact.field === 'informationSystemImpacted') ? markerId('informationSystemImpacted') : undefined}
            errorId={systemErrorId}
            hint="Search by name. Systems selected on the request come first."
            invalid={Boolean(formState.errors.informationSystemImpacted)}
            label="Information system impacted"
            labelSuffix={marker('informationSystemImpacted', 'Information system impacted')}
            noMatchText="No matching information systems. Try another name."
            noun="system"
            nounPlural="information systems"
            onValueChange={(item) => chooseRelation('informationSystemImpacted', item)}
            otherGroupLabel="Other information systems"
            pageSize={inventoryPickerPageSize}
            search={options.searchSystems}
            searchingText="Searching information systems…"
            suggested={requestRelationGroup(options.requestSystems)}
            value={selectedSystem}
          />
          <FieldError id={systemErrorId} message={formState.errors.informationSystemImpacted?.message} />
        </div>
        <div className="grid min-w-0 gap-2">
          <RelationPicker
            descriptionId={provenance?.fields.some((fact) => fact.field === 'informationAssetImpacted') ? markerId('informationAssetImpacted') : undefined}
            errorId={assetErrorId}
            hint="Search by name. Assets selected on the request come first."
            invalid={Boolean(formState.errors.informationAssetImpacted)}
            label="Information asset impacted"
            labelSuffix={marker('informationAssetImpacted', 'Information asset impacted')}
            noMatchText="No matching information assets. Try another name."
            noun="asset"
            nounPlural="information assets"
            onValueChange={(item) => chooseRelation('informationAssetImpacted', item)}
            otherGroupLabel="Other information assets"
            pageSize={inventoryPickerPageSize}
            search={options.searchAssets}
            searchingText="Searching information assets…"
            suggested={requestRelationGroup(options.requestAssets)}
            value={selectedAsset}
          />
          <FieldError id={assetErrorId} message={formState.errors.informationAssetImpacted?.message} />
        </div>
        {choiceFields.map(([name, label, choices]) => (
          <div className="grid gap-1" key={name}>
            <SelectField idPrefix={`risk-${risk?.documentId ?? 'new'}`} describedBy={describedBy(name, formState.errors[name]?.message)} error={formState.errors[name]?.message} label={label} marker={marker(name, label)} name={name} options={choices.map((value) => ({ value, label: value }))} register={register} />
            <FieldHint id={noteId(name)} text={notes[name] ?? null} />
          </div>
        ))}
        {dateFields.map(([name, label]) => (
          <label className="grid gap-2" key={name}><span className="text-sm font-medium">{label}</span><Input aria-describedby={formState.errors[name] ? `${name}-error` : undefined} aria-invalid={Boolean(formState.errors[name])} type="date" {...register(name)} /><FieldError id={`${name}-error`} message={formState.errors[name]?.message} /></label>
        ))}
        <label className="grid gap-2"><span className="text-sm font-medium">Exemption review date</span><Input aria-describedby={formState.errors.exemptionReviewDate ? 'exemptionReviewDate-error' : undefined} aria-invalid={Boolean(formState.errors.exemptionReviewDate)} type="date" {...register('exemptionReviewDate')} /><FieldError id="exemptionReviewDate-error" message={formState.errors.exemptionReviewDate?.message} /></label>
        <div><OwnerCombobox errorId="treatmentOwner-error" invalid={Boolean(formState.errors.treatmentOwner)} label="Treatment owner" onValueChange={(owner) => chooseOwner('treatmentOwner', owner)} searchOwners={searchOwners} value={selectedTreatmentOwner} /><FieldError id="treatmentOwner-error" message={formState.errors.treatmentOwner?.message} /></div>
        <label className="grid gap-2"><span className="text-sm font-medium">Exempted</span><select aria-describedby={formState.errors.isExempted ? 'isExempted-error' : undefined} aria-invalid={Boolean(formState.errors.isExempted)} className="h-9 min-w-0 rounded-md border border-input bg-surface px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring" value={watch('isExempted') === null ? '' : String(watch('isExempted'))} onChange={(event) => setValue('isExempted', event.target.value === '' ? null : event.target.value === 'true', { shouldDirty: true })}><option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option></select><FieldError id="isExempted-error" message={formState.errors.isExempted?.message} /></label>
      </div>
      {/* X-1: the confirmation sits beside Save from 640px and below it on a phone. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center" data-slot="form-actions">
        <Button disabled={formState.isSubmitting} type="submit">{formState.isSubmitting ? 'Saving risk…' : mode === 'create' ? 'Add risk' : 'Save risk'}</Button>
        {mode === 'create' && onDiscard ? <Button data-print="hidden" disabled={formState.isSubmitting} onClick={discard} type="button" variant="ghost">Discard new risk</Button> : null}
        <SaveStatus savedLabel={(time) => (confirmation.verb === 'added' ? <>Risk added at {time}</> : <>Risk saved at {time}</>)} status={confirmation.status} />
      </div>
    </form>
  );
}

type SelectName = 'riskType' | 'dataClassification' | 'inherentRating' | 'residualRating' | 'controlEffectiveness'
  | 'riskVelocity' | 'treatmentAction' | 'treatmentStatus';

function SelectField({ describedBy, error, idPrefix, label, marker, name, options, register }: {
  describedBy?: string;
  error?: string;
  /** Unique per Risk form, so each label names its own select when several Risks are on the page. */
  idPrefix: string;
  label: string;
  marker?: ReactNode;
  name: SelectName;
  options: readonly { value: string; label: string }[];
  register: ReturnType<typeof useForm<RiskUpdateInput>>['register'];
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2"><label className="text-sm font-medium" htmlFor={`${idPrefix}-${name}`}>{label}</label>{marker}</div>
      <select aria-describedby={describedBy ?? (error ? `${name}-error` : undefined)} aria-invalid={Boolean(error)} className="h-9 min-w-0 rounded-md border border-input bg-surface px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring" id={`${idPrefix}-${name}`} {...register(name)}>
        <option value="">Not specified</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <FieldError id={`${name}-error`} message={error} />
    </div>
  );
}

/* A note the field's description names (walk D13(c)), so a screen reader hears it with the marker. */
function FieldHint({ id, text }: { id: string; text: string | null }) {
  return text ? <p className="text-xs text-foreground-secondary" id={id}>{text}</p> : null;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <span className="flex items-start gap-1 text-sm text-destructive" id={id}><AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{message}</span> : null;
}
