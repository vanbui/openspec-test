'use client';

import { AlertCircleIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import {
  RelationPicker,
  type RelationPickerGroup,
  type RelationPickerItem,
  type RelationPickerSearchInput,
  type RelationPickerSearchResult,
} from '@/components/csrm/relation-picker';
import { SaveStatus } from '@/components/csrm/save-status';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createControlImplementationAction,
  deleteControlImplementationAction,
  updateControlImplementationAction,
} from './assessment-actions';
import { changedWritableValues, controlImplementationWritableFields, controlPickerPageSize } from './assessment-domain';
import { controlPickerItem } from './control-label';
import { OwnerCombobox, type OwnerSearchInput, type OwnerSearchResult } from './owner-combobox';
import type {
  ActiveUser,
  ControlImplementation,
  ControlImplementationUpdateInput,
} from './assessment-schema';
import { useRecordSaveStatus } from './use-record-save-status';

export type ControlImplementationEditorOptions = {
  /** The Risk Type's applicable controls, offered first in the Control picker (D-31). */
  suggestedControls?: RelationPickerGroup;
  /** Searches the whole control library by number, name or framework (D-29). */
  searchControls: (input: RelationPickerSearchInput) => Promise<RelationPickerSearchResult>;
  /** Searches every active user for the control owner (D-28), the search the Risk owner pickers already use. */
  searchOwners: (input: OwnerSearchInput) => Promise<OwnerSearchResult>;
};

/** The control search's page size (Administration list sizes 10, 25, 50 and 100). */
export const controlSearchPageSize = controlPickerPageSize;

export type ControlImplementationEditorProps = {
  assessmentId: string;
  implementation?: ControlImplementation;
  mode: 'create' | 'edit';
  options: ControlImplementationEditorOptions;
  riskId: string;
  onCreated?: (implementation: ControlImplementation) => void;
  /** Hands the page the record Strapi saved, so the page and this form both hold the latest saved values (CR-201). */
  onUpdated?: (implementation: ControlImplementation) => void;
  onRemoved?: (implementationId: string) => void;
  /** Moves focus to the Control input when the form opens (UI-SPEC §13.1). */
  focusControlOnOpen?: boolean;
  /** When this control was just added, so its new form confirms `Mitigation control added at {time}` (UI-SPEC §13.4). */
  addedAt?: string;
};

const emptyValues: ControlImplementationUpdateInput = {
  control: null,
  controlOwner: null,
  controlStatus: null,
  effectivenessRating: null,
  evidence: null,
  implementationDueDate: null,
  implementedDate: null,
  reviewDate: null,
};

function initialValues(implementation?: ControlImplementation): ControlImplementationUpdateInput {
  if (!implementation) return emptyValues;
  return {
    control: implementation.control,
    controlOwner: implementation.controlOwner?.documentId ?? null,
    controlStatus: implementation.controlStatus,
    effectivenessRating: implementation.effectivenessRating,
    evidence: implementation.evidence,
    implementationDueDate: implementation.implementationDueDate,
    implementedDate: implementation.implementedDate,
    reviewDate: implementation.reviewDate,
  };
}

/**
 * The chosen control as the picker shows it: named by its served summary (D-30, D-36), or `Control not found`
 * when the library no longer holds it. Never its id.
 */
function initialControl(implementation?: ControlImplementation): RelationPickerItem | null {
  if (!implementation?.control) return null;
  return implementation.controlSummary
    ? controlPickerItem(implementation.controlSummary)
    : { documentId: implementation.control, name: 'Control not found' };
}

function normalizeEmptyValues(values: ControlImplementationUpdateInput): ControlImplementationUpdateInput {
  return Object.fromEntries(controlImplementationWritableFields.map((field) => [field, values[field] === '' ? null : values[field]])) as ControlImplementationUpdateInput;
}

export function ControlImplementationEditor({ addedAt, assessmentId, focusControlOnOpen = false, implementation, mode, onCreated, onRemoved, onUpdated, options, riskId }: ControlImplementationEditorProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [selectedControl, setSelectedControl] = useState<RelationPickerItem | null>(() => initialControl(implementation));
  // The served owner names the choice until the analyst picks another active user (D-28).
  const [selectedOwner, setSelectedOwner] = useState<ActiveUser | null>(() => implementation?.controlOwner ?? null);
  const controlInput = useRef<HTMLInputElement>(null);
  const controlErrorId = useId();
  const ownerErrorId = useId();
  /*
   * The record last saved is what the next save compares with (CR-201): Strapi's answer to each save replaces
   * it, and a newer record from the page does too. The page-load record never stays the baseline, so a field
   * set back to its page-load value after a save is a change and is sent.
   */
  const [savedImplementation, setSavedImplementation] = useState(implementation);
  const [pageImplementation, setPageImplementation] = useState(implementation);
  if (implementation !== pageImplementation) {
    setPageImplementation(implementation);
    setSavedImplementation(implementation);
  }
  const initial = initialValues(savedImplementation);
  const form = useForm<ControlImplementationUpdateInput>({ defaultValues: initial });
  const confirmation = useRecordSaveStatus(form.watch, addedAt);

  useEffect(() => {
    if (focusControlOnOpen) controlInput.current?.focus();
  }, [focusControlOnOpen]);

  function chooseControl(control: RelationPickerItem | null) {
    setSelectedControl(control);
    form.setValue('control', control?.documentId ?? null, { shouldDirty: true });
    form.clearErrors('control');
  }

  function chooseOwner(owner: ActiveUser | null) {
    setSelectedOwner(owner);
    form.setValue('controlOwner', owner?.documentId ?? null, { shouldDirty: true });
    form.clearErrors('controlOwner');
  }

  async function submit(values: ControlImplementationUpdateInput) {
    setFormError(null);
    confirmation.clear();
    const normalized = normalizeEmptyValues(values);
    const submitted = mode === 'create' ? normalized : changedWritableValues(controlImplementationWritableFields, normalized, initial);
    if (mode === 'edit' && Object.keys(submitted).length === 0) {
      confirmation.note('No changes to save.');
      return;
    }
    const result = mode === 'create'
      ? await createControlImplementationAction({ assessmentId, riskId, values: submitted })
      : await updateControlImplementationAction({ assessmentId, implementationId: implementation?.documentId, values: submitted });
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages?.[0];
        if (message && controlImplementationWritableFields.includes(field as keyof ControlImplementationUpdateInput)) {
          form.setError(field as keyof ControlImplementationUpdateInput, { message });
        }
      }
      setFormError(result.formError);
      return;
    }
    // Confirmed only after an ok result, so a save that did not persist never reads as saved (T-10-54).
    if (mode === 'create') onCreated?.(result.data);
    else {
      setSavedImplementation(result.data);
      confirmation.saved();
      onUpdated?.(result.data);
    }
  }

  async function remove() {
    if (!implementation) return;
    setRemoveError(null);
    const result = await deleteControlImplementationAction({ assessmentId, implementationId: implementation.documentId });
    if (!result.ok) {
      setRemoveError(result.formError);
      throw new Error('Removal failed');
    }
    onRemoved?.(implementation.documentId);
  }

  return (
    <form className="grid gap-5 rounded-lg border border-border bg-surface-muted p-4" noValidate onSubmit={form.handleSubmit(submit)}>
      {formError ? <Alert variant="destructive"><AlertTitle>Mitigation control not changed</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <RelationPicker
            errorId={controlErrorId}
            hint="Search by control number, name or framework. Controls that apply to the Risk Type come first."
            inputRef={controlInput}
            invalid={Boolean(form.formState.errors.control)}
            label="Control"
            noMatchText="No matching controls. Try a control number, name or framework."
            noun="control"
            onValueChange={chooseControl}
            otherGroupLabel="Other controls"
            pageSize={controlSearchPageSize}
            search={options.searchControls}
            searchingText="Searching controls…"
            suggested={options.suggestedControls}
            value={selectedControl}
          />
          <FieldError id={controlErrorId} message={form.formState.errors.control?.message} />
        </div>
        <div className="grid min-w-0 gap-2">
          <OwnerCombobox errorId={ownerErrorId} invalid={Boolean(form.formState.errors.controlOwner)} label="Control owner" onValueChange={chooseOwner} searchOwners={options.searchOwners} value={selectedOwner} />
          <FieldError id={ownerErrorId} message={form.formState.errors.controlOwner?.message} />
        </div>
        <Choice error={form.formState.errors.controlStatus?.message} label="Control status" name="controlStatus" options={['Existing', 'Planned', 'Implemented', 'Retired']} register={form.register} />
        <Choice error={form.formState.errors.effectivenessRating?.message} label="Effectiveness rating" name="effectivenessRating" options={['Effective', 'Partially Effective', 'Ineffective', 'Not Assessed']} register={form.register} />
        <label className="grid gap-2 md:col-span-2"><span className="text-sm font-medium">Evidence</span><Textarea aria-describedby={form.formState.errors.evidence ? 'evidence-error' : undefined} aria-invalid={Boolean(form.formState.errors.evidence)} {...form.register('evidence')} /><FieldError id="evidence-error" message={form.formState.errors.evidence?.message} /></label>
        <DateField error={form.formState.errors.implementationDueDate?.message} label="Implementation due date" name="implementationDueDate" register={form.register} />
        <DateField error={form.formState.errors.implementedDate?.message} label="Implemented date" name="implementedDate" register={form.register} />
        <DateField error={form.formState.errors.reviewDate?.message} label="Review date" name="reviewDate" register={form.register} />
      </div>
      {/* X-1: the confirmation sits beside the buttons from 640px and below them on a phone. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center" data-slot="form-actions">
        <div className="flex flex-wrap gap-3">
          <Button disabled={form.formState.isSubmitting} type="submit">{mode === 'create' ? 'Add mitigation control' : 'Save mitigation control'}</Button>
          {mode === 'edit' ? <ConfirmDialog confirmLabel="Remove mitigation control" confirmVariant="destructive" description="This removes the control from this Risk. The control stays in the library." errorMessage={removeError} onConfirm={remove} pendingLabel="Removing mitigation control…" title="Remove this mitigation control?" trigger={<Button type="button" variant="outline">Remove mitigation control</Button>} /> : null}
        </div>
        <SaveStatus savedLabel={(time) => (confirmation.verb === 'added' ? <>Mitigation control added at {time}</> : <>Mitigation control saved at {time}</>)} status={confirmation.status} />
      </div>
    </form>
  );
}

type ControlField = 'controlStatus' | 'effectivenessRating';
function Choice({ error, label, name, options, register }: { error?: string; label: string; name: ControlField; options: readonly string[]; register: ReturnType<typeof useForm<ControlImplementationUpdateInput>>['register'] }) {
  return <label className="grid gap-2"><span className="text-sm font-medium">{label}</span><select aria-describedby={error ? `${name}-error` : undefined} aria-invalid={Boolean(error)} className="h-9 min-w-0 rounded-md border border-input bg-surface px-3 text-sm" {...register(name)}><option value="">Not specified</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><FieldError id={`${name}-error`} message={error} /></label>;
}

type DateFieldName = 'implementationDueDate' | 'implementedDate' | 'reviewDate';
function DateField({ error, label, name, register }: { error?: string; label: string; name: DateFieldName; register: ReturnType<typeof useForm<ControlImplementationUpdateInput>>['register'] }) {
  return <label className="grid gap-2"><span className="text-sm font-medium">{label}</span><Input aria-describedby={error ? `${name}-error` : undefined} aria-invalid={Boolean(error)} type="date" {...register(name)} /><FieldError id={`${name}-error`} message={error} /></label>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <span className="flex items-start gap-1 text-sm text-destructive" id={id}><AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{message}</span> : null;
}
