'use client';

import { AlertCircleIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  RelationPicker,
  type RelationPickerItem,
  type RelationPickerSearchInput,
  type RelationPickerSearchResult,
} from '@/components/csrm/relation-picker';
import { SaveStatus } from '@/components/csrm/save-status';
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
  AnalystRisk,
  Risk,
  RiskType,
  RiskUpdateInput,
} from './assessment-schema';

export type AssessmentRelationOption = { documentId: string; name: string };
export type EditableRisk = AnalystRisk;

export type RelationSearch = (input: RelationPickerSearchInput) => Promise<RelationPickerSearchResult>;

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
  onUpdated?: (risk: EditableRisk) => void;
  /** Tells the page the name of a record chosen by search, so a remounted editor keeps it (D-30). */
  onRelationChosen?: (item: RelationPickerItem) => void;
  /** When this Risk was just added, so its new card confirms `Risk added at {time}` (UI-SPEC §13.4). */
  addedAt?: string;
};

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

export function RiskEditor({ addedAt, assessmentId, mode, onCreated, onRelationChosen, onUpdated, options, risk, searchOwners }: RiskEditorProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const initial = selectedValues(risk);
  const form = useForm<RiskUpdateInput>({ defaultValues: initial });
  const { clearErrors, formState, handleSubmit, register, setError, setValue, watch } = form;
  const confirmation = useRecordSaveStatus(watch, addedAt);
  const systemErrorId = useId();
  const assetErrorId = useId();
  // The chosen system and asset keep their names when they are not on the current search page (D-30).
  const [selectedSystem, setSelectedSystem] = useState<RelationPickerItem | null>(() => selectedRelationItem(risk?.informationSystemImpacted, options.requestSystems, options.relationLabels));
  const [selectedAsset, setSelectedAsset] = useState<RelationPickerItem | null>(() => selectedRelationItem(risk?.informationAssetImpacted, options.requestAssets, options.relationLabels));
  const chooseRelation = (field: RelationField, item: RelationPickerItem | null) => {
    if (field === 'informationSystemImpacted') setSelectedSystem(item);
    else setSelectedAsset(item);
    setValue(field, item?.documentId ?? null, { shouldDirty: true });
    clearErrors(field);
    if (item) onRelationChosen?.(item);
  };
  const [selectedOwners, setSelectedOwners] = useState<Record<string, ActiveUser>>(() => Object.fromEntries(options.users.map((owner) => [owner.documentId, owner])));
  useEffect(() => {
    setSelectedOwners((current) => ({ ...Object.fromEntries(options.users.map((owner) => [owner.documentId, owner])), ...current }));
  }, [options.users]);
  const selectedRiskOwner = selectedOwners[watch('riskOwner') ?? ''] ?? null;
  const selectedTreatmentOwner = selectedOwners[watch('treatmentOwner') ?? ''] ?? null;
  const chooseOwner = (field: 'riskOwner' | 'treatmentOwner', owner: ActiveUser | null) => {
    if (owner) setSelectedOwners((current) => ({ ...current, [owner.documentId]: owner }));
    setValue(field, owner?.documentId ?? null, { shouldDirty: true });
  };

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
      return;
    }
    // Confirmed only after an ok result, so a save that did not persist never reads as saved (T-10-54).
    if (mode === 'create') onCreated?.({ ...normalized, ...result.data } as EditableRisk);
    else {
      confirmation.saved();
      onUpdated?.({ ...risk, ...submitted, ...result.data } as EditableRisk);
    }
  }

  return (
    <form className="grid min-w-0 gap-6" noValidate onSubmit={handleSubmit(submit)}>
      {formError ? <Alert variant="destructive"><AlertTitle>Risk not saved</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
      <div className="grid gap-5 md:grid-cols-2">
        {textFields.map(([name, label, multiline]) => (
          <label className={multiline ? 'grid gap-2 md:col-span-2' : 'grid gap-2'} key={name}>
            <span className="text-sm font-medium">{label}</span>
            {multiline
              ? <Textarea aria-describedby={formState.errors[name] ? `${name}-error` : undefined} aria-invalid={Boolean(formState.errors[name])} {...register(name)} />
              : <Input aria-describedby={formState.errors[name] ? `${name}-error` : undefined} aria-invalid={Boolean(formState.errors[name])} {...register(name)} />}
            <FieldError id={`${name}-error`} message={formState.errors[name]?.message} />
          </label>
        ))}
        <SelectField error={formState.errors.riskType?.message} label="Risk type" name="riskType" options={options.riskTypes.map((item) => ({ value: item.documentId, label: item.name }))} register={register} />
        <div><OwnerCombobox errorId="riskOwner-error" invalid={Boolean(formState.errors.riskOwner)} label="Risk owner" onValueChange={(owner) => chooseOwner('riskOwner', owner)} searchOwners={searchOwners} value={selectedRiskOwner} /><FieldError id="riskOwner-error" message={formState.errors.riskOwner?.message} /></div>
        <div className="grid min-w-0 gap-2">
          <RelationPicker
            errorId={systemErrorId}
            hint="Search by name. Systems selected on the request come first."
            invalid={Boolean(formState.errors.informationSystemImpacted)}
            label="Information system impacted"
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
            errorId={assetErrorId}
            hint="Search by name. Assets selected on the request come first."
            invalid={Boolean(formState.errors.informationAssetImpacted)}
            label="Information asset impacted"
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
        {choiceFields.map(([name, label, values]) => <SelectField error={formState.errors[name]?.message} key={name} label={label} name={name} options={values.map((value) => ({ value, label: value }))} register={register} />)}
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
        <SaveStatus savedLabel={(time) => (confirmation.verb === 'added' ? <>Risk added at {time}</> : <>Risk saved at {time}</>)} status={confirmation.status} />
      </div>
    </form>
  );
}

type SelectName = 'riskType' | 'dataClassification' | 'inherentRating' | 'residualRating' | 'controlEffectiveness'
  | 'riskVelocity' | 'treatmentAction' | 'treatmentStatus';

function SelectField({ error, label, name, options, register }: {
  error?: string;
  label: string;
  name: SelectName;
  options: readonly { value: string; label: string }[];
  register: ReturnType<typeof useForm<RiskUpdateInput>>['register'];
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <select aria-describedby={error ? `${name}-error` : undefined} aria-invalid={Boolean(error)} className="h-9 min-w-0 rounded-md border border-input bg-surface px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring" {...register(name)}>
        <option value="">Not specified</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <FieldError id={`${name}-error`} message={error} />
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <span className="flex items-start gap-1 text-sm text-destructive" id={id}><AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{message}</span> : null;
}
