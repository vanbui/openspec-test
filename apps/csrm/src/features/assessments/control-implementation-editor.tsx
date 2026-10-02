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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createControlImplementationAction,
  deleteControlImplementationAction,
  updateControlImplementationAction,
} from './assessment-actions';
import { controlImplementationWritableFields, controlPickerPageSize } from './assessment-domain';
import { controlPickerItem } from './control-label';
import type {
  ControlImplementation,
  ControlImplementationUpdateInput,
} from './assessment-schema';
import type { RiskEditorOptions } from './risk-editor';

export type ControlImplementationEditorOptions = Pick<RiskEditorOptions, 'users'> & {
  /** The Risk Type's applicable controls, offered first in the Control picker (D-31). */
  suggestedControls?: RelationPickerGroup;
  /** Searches the whole control library by number, name or framework (D-29). */
  searchControls: (input: RelationPickerSearchInput) => Promise<RelationPickerSearchResult>;
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
  onUpdated?: () => void;
  onRemoved?: (implementationId: string) => void;
  /** Moves focus to the Control input when the form opens (UI-SPEC §13.1). */
  focusControlOnOpen?: boolean;
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

function changedValues(values: ControlImplementationUpdateInput, initial: ControlImplementationUpdateInput) {
  return Object.fromEntries(controlImplementationWritableFields.filter((field) => values[field] !== initial[field]).map((field) => [field, values[field]])) as ControlImplementationUpdateInput;
}

export function ControlImplementationEditor({ assessmentId, focusControlOnOpen = false, implementation, mode, onCreated, onRemoved, onUpdated, options, riskId }: ControlImplementationEditorProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedControl, setSelectedControl] = useState<RelationPickerItem | null>(() => initialControl(implementation));
  const controlInput = useRef<HTMLInputElement>(null);
  const controlErrorId = useId();
  const initial = initialValues(implementation);
  const form = useForm<ControlImplementationUpdateInput>({ defaultValues: initial });

  useEffect(() => {
    if (focusControlOnOpen) controlInput.current?.focus();
  }, [focusControlOnOpen]);

  function chooseControl(control: RelationPickerItem | null) {
    setSelectedControl(control);
    form.setValue('control', control?.documentId ?? null, { shouldDirty: true });
    form.clearErrors('control');
  }

  async function submit(values: ControlImplementationUpdateInput) {
    setFormError(null);
    setStatusMessage(null);
    const normalized = normalizeEmptyValues(values);
    const submitted = mode === 'create' ? normalized : changedValues(normalized, initial);
    if (mode === 'edit' && Object.keys(submitted).length === 0) {
      setStatusMessage('No changes to save.');
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
    if (mode === 'create') onCreated?.(result.data);
    else onUpdated?.();
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
      <p aria-atomic="true" aria-live="polite" role="status">{statusMessage ?? ''}</p>
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
        <label className="grid gap-2"><span className="text-sm font-medium">Control owner</span><select aria-describedby={form.formState.errors.controlOwner ? 'controlOwner-error' : undefined} aria-invalid={Boolean(form.formState.errors.controlOwner)} className="h-9 min-w-0 rounded-md border border-input bg-surface px-3 text-sm" {...form.register('controlOwner')}><option value="">Not specified</option>{options.users.map((user) => <option key={user.documentId} value={user.documentId}>{user.displayName}</option>)}</select><FieldError id="controlOwner-error" message={form.formState.errors.controlOwner?.message} /></label>
        <Choice error={form.formState.errors.controlStatus?.message} label="Control status" name="controlStatus" options={['Existing', 'Planned', 'Implemented', 'Retired']} register={form.register} />
        <Choice error={form.formState.errors.effectivenessRating?.message} label="Effectiveness rating" name="effectivenessRating" options={['Effective', 'Partially Effective', 'Ineffective', 'Not Assessed']} register={form.register} />
        <label className="grid gap-2 md:col-span-2"><span className="text-sm font-medium">Evidence</span><Textarea aria-describedby={form.formState.errors.evidence ? 'evidence-error' : undefined} aria-invalid={Boolean(form.formState.errors.evidence)} {...form.register('evidence')} /><FieldError id="evidence-error" message={form.formState.errors.evidence?.message} /></label>
        <DateField error={form.formState.errors.implementationDueDate?.message} label="Implementation due date" name="implementationDueDate" register={form.register} />
        <DateField error={form.formState.errors.implementedDate?.message} label="Implemented date" name="implementedDate" register={form.register} />
        <DateField error={form.formState.errors.reviewDate?.message} label="Review date" name="reviewDate" register={form.register} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button disabled={form.formState.isSubmitting} type="submit">{mode === 'create' ? 'Add mitigation control' : 'Save mitigation control'}</Button>
        {mode === 'edit' ? <ConfirmDialog confirmLabel="Remove mitigation control" confirmVariant="destructive" description="This removes the control from this Risk. The control stays in the library." errorMessage={removeError} onConfirm={remove} pendingLabel="Removing mitigation control…" title="Remove this mitigation control?" trigger={<Button type="button" variant="outline">Remove mitigation control</Button>} /> : null}
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
