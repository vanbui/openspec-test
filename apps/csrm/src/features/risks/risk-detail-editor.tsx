'use client';

import { AlertCircleIcon } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import {
  RelationPicker,
  type RelationPickerItem,
  type RelationPickerSearchInput,
  type RelationPickerSearchResult,
} from '@/components/csrm/relation-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  exemptionReviewDateFormValue,
  inventoryPickerPageSize,
  requestRelationGroup,
  riskWritableFields,
  withExemptionReviewInstant,
} from '@/features/assessments/assessment-domain';
import type {
  ActiveUser,
  RiskType,
  RiskUpdateInput,
} from '@/features/assessments/assessment-schema';
import { OwnerCombobox, type OwnerSearchInput, type OwnerSearchResult } from '@/features/assessments/owner-combobox';
import { updateRiskDetailAction, type RiskDetailServerActionResult } from './risk-actions';
import type { RiskDetail } from './risk-schema';

type NamedRecord = { documentId: string; name: string };
export type RiskRelationSearch = (input: RelationPickerSearchInput) => Promise<RelationPickerSearchResult>;

export type RiskDetailsOptions = {
  /** The picker Risk Type list: each type carries its applicable controls for the Control picker (D-31). */
  riskTypes: readonly Pick<RiskType, 'documentId' | 'name' | 'description' | 'applicableControls'>[];
  users: readonly ActiveUser[];
  /** The originating request's selected systems and assets, offered first; empty when they could not be read (D-30). */
  requestSystems: readonly NamedRecord[];
  requestAssets: readonly NamedRecord[];
  /** Search the whole control library and inventories, one bounded page at a time (D-28, D-29). */
  searchControls: RiskRelationSearch;
  searchSystems: RiskRelationSearch;
  searchAssets: RiskRelationSearch;
};

type RelationField = 'informationSystemImpacted' | 'informationAssetImpacted';
type SelectedRelations = Record<RelationField, RelationPickerItem | null>;

export type RiskOwnerSearch = (input: OwnerSearchInput) => Promise<OwnerSearchResult>;

type RiskDetailEditorProps = {
  detail: RiskDetail;
  onCancel: () => void;
  onConflict: (result: Extract<RiskDetailServerActionResult<never>, { conflict: true }>) => void;
  onNoChange: () => void;
  onSaved: (detail: RiskDetail) => void;
  options: RiskDetailsOptions;
  searchOwners: RiskOwnerSearch;
};

const textFields = [
  ['issueStatement', 'Issue statement', true], ['riskStatement', 'Risk statement', true],
  ['riskCategory', 'Risk category', false], ['riskSubCategory', 'Risk sub-category', false],
  ['riskCause', 'Risk cause', true], ['potentialImpact', 'Potential impact', true],
  ['inherentLikelihood', 'Inherent likelihood', false], ['highestInherentConsequence', 'Highest inherent consequence', false],
  ['inherentRatingRationale', 'Inherent rating rationale', true], ['residualLikelihood', 'Residual likelihood', false],
  ['highestResidualConsequence', 'Highest residual consequence', false], ['residualRatingRationale', 'Residual rating rationale', true],
  ['treatmentPlan', 'Treatment plan', true], ['escalationDetails', 'Escalation details', true], ['comments', 'Comments', true],
] as const;

const dateFields = [
  ['identifiedDate', 'Identified date'], ['targetDate', 'Target date'], ['treatmentResolveDate', 'Treatment resolve date'],
  ['closureDate', 'Closure date'], ['riskCommunicationDate', 'Risk communication date'],
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

function initialValues(detail: RiskDetail): RiskUpdateInput {
  return {
    issueStatement: detail.issueStatement,
    riskStatement: detail.riskStatement,
    riskCategory: detail.riskCategory,
    riskSubCategory: detail.riskSubCategory,
    riskCause: detail.riskCause,
    potentialImpact: detail.potentialImpact,
    riskType: detail.riskType?.documentId ?? null,
    riskOwner: detail.riskOwner?.documentId ?? null,
    informationSystemImpacted: detail.informationSystemImpacted?.documentId ?? null,
    informationAssetImpacted: detail.informationAssetImpacted?.documentId ?? null,
    dataClassification: detail.dataClassification,
    inherentLikelihood: detail.inherentLikelihood,
    highestInherentConsequence: detail.highestInherentConsequence,
    inherentRating: detail.inherentRating,
    inherentRatingRationale: detail.inherentRatingRationale,
    residualLikelihood: detail.residualLikelihood,
    highestResidualConsequence: detail.highestResidualConsequence,
    residualRating: detail.residualRating,
    residualRatingRationale: detail.residualRatingRationale,
    controlEffectiveness: detail.controlEffectiveness,
    riskVelocity: detail.riskVelocity,
    identifiedDate: detail.identifiedDate,
    targetDate: detail.targetDate,
    closureDate: detail.closureDate,
    isExempted: detail.isExempted,
    // The date field holds the stored instant's UTC date, so an untouched legacy value compares unchanged (D-32).
    exemptionReviewDate: exemptionReviewDateFormValue(detail.exemptionReviewDate) || null,
    escalationDetails: detail.escalationDetails,
    comments: detail.comments,
    riskCommunicationDate: detail.riskCommunicationDate,
    treatmentAction: detail.treatmentAction,
    treatmentPlan: detail.treatmentPlan,
    treatmentOwner: detail.treatmentOwner?.documentId ?? null,
    treatmentResolveDate: detail.treatmentResolveDate,
    treatmentStatus: detail.treatmentStatus,
  };
}

function normalize(values: RiskUpdateInput): RiskUpdateInput {
  return Object.fromEntries(riskWritableFields.map((field) => [field, values[field] === '' ? null : values[field]])) as RiskUpdateInput;
}

function delta(values: RiskUpdateInput, initial: RiskUpdateInput): RiskUpdateInput {
  return Object.fromEntries(riskWritableFields.filter((field) => values[field] !== initial[field]).map((field) => [field, values[field]])) as RiskUpdateInput;
}

function relation<T extends { documentId: string }>(items: readonly T[], id: unknown): T | null {
  return typeof id === 'string' ? items.find((item) => item.documentId === id) ?? null : null;
}

/** The saved system or asset, named by the record the analyst chose in its picker (D-30). */
function chosenRelation(item: RelationPickerItem | null, id: unknown): NamedRecord | null {
  return item && typeof id === 'string' && item.documentId === id ? { documentId: item.documentId, name: item.name } : null;
}

function riskTypeRelation(options: RiskDetailsOptions, id: unknown): RiskDetail['riskType'] {
  const riskType = relation(options.riskTypes, id);
  return riskType ? { documentId: riskType.documentId, name: riskType.name, description: riskType.description } : null;
}

function mergeDetail(detail: RiskDetail, values: RiskUpdateInput, result: Record<string, unknown>, options: RiskDetailsOptions, selectedOwners: Record<string, ActiveUser>, selected: SelectedRelations): RiskDetail {
  const scalar = { ...values, ...result };
  return {
    ...detail,
    ...scalar,
    documentId: detail.documentId,
    riskNumber: typeof result.riskNumber === 'string' ? result.riskNumber : detail.riskNumber,
    parentLock: detail.parentLock,
    riskType: 'riskType' in values ? riskTypeRelation(options, values.riskType) : detail.riskType,
    riskOwner: 'riskOwner' in values ? relation(Object.values(selectedOwners), values.riskOwner) : detail.riskOwner,
    treatmentOwner: 'treatmentOwner' in values ? relation(Object.values(selectedOwners), values.treatmentOwner) : detail.treatmentOwner,
    informationSystemImpacted: 'informationSystemImpacted' in values ? chosenRelation(selected.informationSystemImpacted, values.informationSystemImpacted) : detail.informationSystemImpacted,
    informationAssetImpacted: 'informationAssetImpacted' in values ? chosenRelation(selected.informationAssetImpacted, values.informationAssetImpacted) : detail.informationAssetImpacted,
  } as RiskDetail;
}

export function RiskDetailEditor({ detail, onCancel, onConflict, onNoChange, onSaved, options, searchOwners }: RiskDetailEditorProps) {
  const initial = useMemo(() => initialValues(detail), [detail]);
  const form = useForm<RiskUpdateInput>({ defaultValues: initial, mode: 'onBlur' });
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedOwners, setSelectedOwners] = useState<Record<string, ActiveUser>>(() => Object.fromEntries(options.users.map((owner) => [owner.documentId, owner])));
  const values = form.watch();
  const selectedRiskOwner = selectedOwners[values.riskOwner ?? ''] ?? null;
  const selectedTreatmentOwner = selectedOwners[values.treatmentOwner ?? ''] ?? null;
  const systemErrorId = useId();
  const assetErrorId = useId();
  // The Risk's served relations name its system and asset until the analyst chooses another (D-30).
  const [selectedRelations, setSelectedRelations] = useState<SelectedRelations>(() => ({
    informationSystemImpacted: detail.informationSystemImpacted ? { ...detail.informationSystemImpacted } : null,
    informationAssetImpacted: detail.informationAssetImpacted ? { ...detail.informationAssetImpacted } : null,
  }));

  function chooseRelation(field: RelationField, item: RelationPickerItem | null) {
    setSelectedRelations((current) => ({ ...current, [field]: item }));
    form.setValue(field, item?.documentId ?? null, { shouldDirty: true, shouldValidate: true });
  }

  function chooseOwner(field: 'riskOwner' | 'treatmentOwner', owner: ActiveUser | null) {
    if (owner) setSelectedOwners((current) => ({ ...current, [owner.documentId]: owner }));
    form.setValue(field, owner?.documentId ?? null, { shouldDirty: true, shouldValidate: true });
  }

  async function submit(raw: RiskUpdateInput) {
    setFormError(null);
    const changed = withExemptionReviewInstant(delta(normalize(raw), initial));
    if (Object.keys(changed).length === 0) {
      onNoChange();
      return;
    }
    const result = await updateRiskDetailAction({ riskId: detail.documentId, values: changed });
    if (!result.ok) {
      if ('conflict' in result && result.conflict) {
        onConflict(result as Extract<RiskDetailServerActionResult<never>, { conflict: true }>);
        return;
      }
      const fieldErrors = 'fieldErrors' in result ? result.fieldErrors : undefined;
      for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
        const message = messages?.[0];
        if (message && riskWritableFields.includes(field as keyof RiskUpdateInput)) form.setError(field as keyof RiskUpdateInput, { message });
      }
      setFormError(result.formError);
      return;
    }
    onSaved(mergeDetail(detail, changed, result.data as unknown as Record<string, unknown>, options, selectedOwners, selectedRelations));
  }

  function cancel() {
    form.reset(initial);
    onCancel();
  }

  const discardButton = <Button type="button" variant="outline" onClick={form.formState.isDirty ? undefined : cancel}>Discard risk changes</Button>;

  return (
    <form aria-label="Edit Risk" className="grid max-w-[640px] gap-6" noValidate onSubmit={form.handleSubmit(submit)}>
      {formError ? <Alert variant="destructive"><AlertTitle>Risk not saved</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
      <div className="grid gap-5">
        {textFields.map(([name, label, multiline], index) => <TextField autoFocus={index === 0} error={form.formState.errors[name]?.message} key={name} label={label} multiline={multiline} name={name} register={form.register} />)}
        <h2 className="pt-2 text-heading-md">Ratings</h2>
        <SelectField error={form.formState.errors.riskType?.message} label="Risk type" name="riskType" options={options.riskTypes.map((item) => ({ label: item.name, value: item.documentId }))} register={form.register} />
        <div><OwnerCombobox errorId="riskOwner-error" invalid={Boolean(form.formState.errors.riskOwner)} label="Risk owner" onValueChange={(owner) => chooseOwner('riskOwner', owner)} searchOwners={searchOwners} value={selectedRiskOwner} /><FieldError id="riskOwner-error" message={form.formState.errors.riskOwner?.message} /></div>
        <div className="grid min-w-0 gap-2">
          <RelationPicker
            errorId={systemErrorId}
            hint="Search by name. Systems selected on the request come first."
            invalid={Boolean(form.formState.errors.informationSystemImpacted)}
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
            value={selectedRelations.informationSystemImpacted}
          />
          <FieldError id={systemErrorId} message={form.formState.errors.informationSystemImpacted?.message} />
        </div>
        <div className="grid min-w-0 gap-2">
          <RelationPicker
            errorId={assetErrorId}
            hint="Search by name. Assets selected on the request come first."
            invalid={Boolean(form.formState.errors.informationAssetImpacted)}
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
            value={selectedRelations.informationAssetImpacted}
          />
          <FieldError id={assetErrorId} message={form.formState.errors.informationAssetImpacted?.message} />
        </div>
        {choiceFields.map(([name, label, choices]) => <SelectField error={form.formState.errors[name]?.message} key={name} label={label} name={name} options={choices.map((value) => ({ label: value, value }))} register={form.register} />)}
        {dateFields.map(([name, label]) => <DateField error={form.formState.errors[name]?.message} key={name} label={label} name={name} register={form.register} />)}
        <DateField error={form.formState.errors.exemptionReviewDate?.message} label="Exemption review date" name="exemptionReviewDate" register={form.register} />
        <h2 className="pt-2 text-heading-md">Ownership and treatment</h2>
        <div><OwnerCombobox errorId="treatmentOwner-error" invalid={Boolean(form.formState.errors.treatmentOwner)} label="Treatment owner" onValueChange={(owner) => chooseOwner('treatmentOwner', owner)} searchOwners={searchOwners} value={selectedTreatmentOwner} /><FieldError id="treatmentOwner-error" message={form.formState.errors.treatmentOwner?.message} /></div>
        <label className="grid gap-2"><span className="text-sm font-medium">Exempted</span><select className="h-9 rounded-md border border-input bg-surface px-3 text-sm" {...form.register('isExempted', { setValueAs: (value) => value === '' ? null : value === 'true' })}><option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option></select></label>
      </div>
      <div className="sticky bottom-0 flex flex-wrap gap-3 border-t border-border bg-surface py-4">
        <Button disabled={form.formState.isSubmitting} type="submit">Save risk</Button>
        {form.formState.isDirty ? <ConfirmDialog confirmLabel="Discard risk changes" confirmVariant="destructive" description="Your unsaved changes will be lost." onConfirm={cancel} pendingLabel="Discarding…" title="Discard unsaved risk changes?" trigger={discardButton} /> : discardButton}
      </div>
    </form>
  );
}

type TextName = (typeof textFields)[number][0];
function TextField({ autoFocus, error, label, multiline, name, register }: { autoFocus?: boolean; error?: string; label: string; multiline: boolean; name: TextName; register: ReturnType<typeof useForm<RiskUpdateInput>>['register'] }) {
  const field = register(name, { maxLength: { value: 65_535, message: `${label} must be 65,535 characters or fewer.` } });
  return <label className="grid gap-2"><span className="text-sm font-medium">{label}</span>{multiline ? <Textarea autoFocus={autoFocus} aria-describedby={`${name}-error`} aria-invalid={Boolean(error)} {...field} /> : <Input autoFocus={autoFocus} aria-describedby={`${name}-error`} aria-invalid={Boolean(error)} {...field} />}<FieldError id={`${name}-error`} message={error} /></label>;
}

type SelectName = 'riskType' | 'dataClassification' | 'inherentRating' | 'residualRating' | 'controlEffectiveness' | 'riskVelocity' | 'treatmentAction' | 'treatmentStatus';
function SelectField({ error, label, name, options, register }: { error?: string; label: string; name: SelectName; options: readonly { label: string; value: string }[]; register: ReturnType<typeof useForm<RiskUpdateInput>>['register'] }) {
  return <label className="grid gap-2"><span className="text-sm font-medium">{label}</span><select aria-describedby={`${name}-error`} aria-invalid={Boolean(error)} className="h-9 rounded-md border border-input bg-surface px-3 text-sm" {...register(name)}><option value="">Not specified</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><FieldError id={`${name}-error`} message={error} /></label>;
}

type DateName = (typeof dateFields)[number][0] | 'exemptionReviewDate';
function DateField({ error, label, name, register }: { error?: string; label: string; name: DateName; register: ReturnType<typeof useForm<RiskUpdateInput>>['register'] }) {
  return <label className="grid gap-2"><span className="text-sm font-medium">{label}</span><Input aria-describedby={`${name}-error`} aria-invalid={Boolean(error)} type="date" {...register(name)} /><FieldError id={`${name}-error`} message={error} /></label>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return <span className="min-h-0 text-sm text-destructive" id={id}>{message ? <><AlertCircleIcon aria-hidden="true" className="mr-1 inline size-4" />{message}</> : null}</span>;
}
