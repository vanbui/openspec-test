'use client';

import { AlertCircleIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { RelationPicker, type RelationPickerItem } from '@/components/csrm/relation-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { applicableControlGroup, controlImplementationWritableFields, controlPickerPageSize } from '@/features/assessments/assessment-domain';
import type {
  ControlImplementation,
  ControlImplementationCreateInput,
  ControlImplementationUpdateInput,
} from '@/features/assessments/assessment-schema';
import { controlLabel } from '@/features/assessments/control-label';
import { chooseRelationMessage } from '@/lib/schemas/validation-messages';
import {
  createMitigationControlAction,
  deleteMitigationControlAction,
  updateMitigationControlAction,
  type RiskDetailServerActionResult,
} from './risk-actions';
import type { RiskDetailsOptions } from './risk-detail-editor';
import type { RiskDetail } from './risk-schema';

type Mitigation = RiskDetail['controlImplementations'][number];
type Conflict = Extract<RiskDetailServerActionResult<never>, { conflict: true }>;

export type MitigationControlListProps = {
  implementations: readonly Mitigation[];
  mutable: boolean;
  onChanged: (implementations: readonly Mitigation[], message: string) => void;
  onConflict: (result: Conflict) => void;
  options?: RiskDetailsOptions;
  riskId: string;
  /** The Risk's saved Risk Type, whose applicable controls the Control picker offers first (D-31). */
  riskTypeId?: string | null;
};

/** UI-SPEC §13.5: a saved control the response cannot name. */
const controlUnavailableMessage = 'The selected control is no longer available. Choose another control.';

const emptyValues: ControlImplementationCreateInput = {
  control: '', controlOwner: null, controlStatus: null, effectivenessRating: null,
  evidence: null, implementationDueDate: null, implementedDate: null, reviewDate: null,
};

function valuesFor(implementation: Mitigation): ControlImplementationCreateInput {
  return {
    control: implementation.control.documentId,
    controlOwner: implementation.controlOwner?.documentId ?? null,
    controlStatus: implementation.controlStatus,
    effectivenessRating: implementation.effectivenessRating,
    evidence: implementation.evidence,
    implementationDueDate: implementation.implementationDueDate,
    implementedDate: implementation.implementedDate,
    reviewDate: implementation.reviewDate,
  };
}

function normalize(values: ControlImplementationCreateInput): ControlImplementationCreateInput {
  return Object.fromEntries(controlImplementationWritableFields.map((field) => [field, values[field] === '' ? null : values[field]])) as ControlImplementationCreateInput;
}

function delta(values: ControlImplementationCreateInput, initial: ControlImplementationCreateInput): ControlImplementationUpdateInput {
  return Object.fromEntries(controlImplementationWritableFields.filter((field) => values[field] !== initial[field]).map((field) => [field, values[field]])) as ControlImplementationUpdateInput;
}

/**
 * The card for a saved mitigation control. The control is named by the response's served summary (10-15), else
 * by the card's current control when the choice did not change; with neither, it cannot be named (null).
 */
function mergeImplementation(current: Mitigation | undefined, values: ControlImplementationCreateInput, result: ControlImplementation, options: RiskDetailsOptions): Mitigation | null {
  const summary = result.controlSummary;
  const control = summary
    ? { documentId: summary.documentId, controlNumber: summary.controlNumber, name: summary.name }
    : current?.control.documentId === values.control ? current.control : undefined;
  if (!control) return null;
  const owner = options.users.find((item) => item.documentId === values.controlOwner) ?? null;
  return {
    documentId: result.documentId || current?.documentId || '',
    control,
    controlOwner: owner,
    controlStatus: values.controlStatus ?? null,
    effectivenessRating: values.effectivenessRating ?? null,
    evidence: values.evidence ?? null,
    implementationDueDate: values.implementationDueDate ?? null,
    implementedDate: values.implementedDate ?? null,
    reviewDate: values.reviewDate ?? null,
  };
}

export function MitigationControlList({ implementations, mutable, onChanged, onConflict, options, riskId, riskTypeId = null }: MitigationControlListProps) {
  const [mode, setMode] = useState<{ kind: 'create' } | { kind: 'edit'; id: string } | null>(null);
  const [removeErrors, setRemoveErrors] = useState<Record<string, string>>({});
  const addRef = useRef<HTMLButtonElement>(null);

  if (implementations.length === 0 && !mutable) {
    return (
      <div className="grid gap-2">
        <h3 className="text-heading-sm">No mitigation controls added</h3>
        <p className="text-sm text-muted-foreground">No mitigation controls were recorded before this assessment was released.</p>
      </div>
    );
  }

  async function remove(implementation: Mitigation) {
    setRemoveErrors((current) => ({ ...current, [implementation.documentId]: '' }));
    const result = await deleteMitigationControlAction({ riskId, implementationId: implementation.documentId });
    if (!result.ok) {
      if ('conflict' in result && result.conflict) {
        onConflict(result as Conflict);
        return;
      }
      setRemoveErrors((current) => ({ ...current, [implementation.documentId]: result.formError }));
      throw new Error('Removal failed.');
    }
    onChanged(implementations.filter((item) => item.documentId !== implementation.documentId), 'Mitigation control removed.');
    requestAnimationFrame(() => addRef.current?.focus());
  }

  return (
    <div className="grid gap-4">
      {implementations.length === 0 ? (
        <div className="grid gap-2">
          <h3 className="text-heading-sm">No mitigation controls added</h3>
          <p className="text-sm text-muted-foreground">Add a control from the library to record how this Risk is mitigated.</p>
        </div>
      ) : null}
      {implementations.map((implementation) => (
        <article className="grid gap-4 rounded-lg border border-border p-4" key={implementation.documentId}>
          {mode?.kind === 'edit' && mode.id === implementation.documentId && options ? (
            <MitigationControlEditor implementation={implementation} mode="edit" onCancel={() => setMode(null)} onChanged={(updated) => { setMode(null); onChanged(implementations.map((item) => item.documentId === updated.documentId ? updated : item), 'Mitigation control changes saved.'); }} onConflict={onConflict} options={options} riskId={riskId} riskTypeId={riskTypeId} />
          ) : (
            <>
              <h3 className="text-heading-sm">{controlLabel(implementation.control)}</h3>
              <dl className="grid gap-4 md:grid-cols-2">
                <Value label="Control" value={controlLabel(implementation.control)} />
                <Value label="Control owner" value={implementation.controlOwner?.displayName} />
                <Value label="Control status" value={implementation.controlStatus} />
                <Value label="Effectiveness rating" value={implementation.effectivenessRating} />
                <Value label="Evidence" value={implementation.evidence} wide />
                <Value label="Implementation due date" value={formatDate(implementation.implementationDueDate)} />
                <Value label="Implemented date" value={formatDate(implementation.implementedDate)} />
                <Value label="Review date" value={formatDate(implementation.reviewDate)} />
              </dl>
              {mutable && options ? <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => setMode({ kind: 'edit', id: implementation.documentId })}>Edit mitigation control</Button><ConfirmDialog cancelLabel="Keep mitigation control" confirmLabel="Remove mitigation control" confirmVariant="destructive" description="This removes the control from this Risk. The control stays in the library." errorMessage={removeErrors[implementation.documentId]} onConfirm={() => remove(implementation)} pendingLabel="Removing mitigation control…" title="Remove this mitigation control?" trigger={<Button type="button" variant="outline">Remove mitigation control</Button>} /></div> : null}
            </>
          )}
        </article>
      ))}
      {mutable && options && mode === null ? <Button ref={addRef} className="w-fit" type="button" onClick={() => setMode({ kind: 'create' })}>Add mitigation control</Button> : null}
      {mutable && options && mode?.kind === 'create' ? <MitigationControlEditor mode="create" onCancel={() => setMode(null)} onChanged={(created) => { setMode(null); onChanged([...implementations, created], 'Mitigation control added.'); }} onConflict={onConflict} options={options} riskId={riskId} riskTypeId={riskTypeId} /> : null}
    </div>
  );
}

function MitigationControlEditor({ implementation, mode, onCancel, onChanged, onConflict, options, riskId, riskTypeId }: {
  implementation?: Mitigation;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onChanged: (implementation: Mitigation) => void;
  onConflict: (result: Conflict) => void;
  options: RiskDetailsOptions;
  riskId: string;
  riskTypeId: string | null;
}) {
  const initial = useMemo(() => implementation ? valuesFor(implementation) : emptyValues, [implementation]);
  const form = useForm<ControlImplementationCreateInput>({ defaultValues: initial, mode: 'onBlur' });
  const [error, setError] = useState<string | null>(null);
  // The chosen control, named by the control label (D-36); the Risk Register's control carries no framework.
  const [selectedControl, setSelectedControl] = useState<RelationPickerItem | null>(() => (
    implementation ? { documentId: implementation.control.documentId, name: controlLabel(implementation.control) } : null
  ));
  const controlInput = useRef<HTMLInputElement>(null);
  const controlErrorId = useId();

  // UI-SPEC §13.1: the form opens with focus in its Control input.
  useEffect(() => { controlInput.current?.focus(); }, []);

  function chooseControl(control: RelationPickerItem | null) {
    setSelectedControl(control);
    form.setValue('control', control?.documentId ?? '', { shouldDirty: true });
    form.clearErrors('control');
  }

  async function submit(raw: ControlImplementationCreateInput) {
    setError(null);
    const normalized = normalize(raw);
    // A mitigation control needs a control: `Choose a control.` under the picker (UI-SPEC §13.1).
    if (!normalized.control) {
      form.setError('control', { message: chooseRelationMessage('control') });
      controlInput.current?.focus();
      return;
    }
    const changed = mode === 'create' ? normalized : delta(normalized, initial);
    if (mode === 'edit' && Object.keys(changed).length === 0) {
      onCancel();
      return;
    }
    const result = mode === 'create'
      ? await createMitigationControlAction({ riskId, values: changed })
      : await updateMitigationControlAction({ riskId, implementationId: implementation?.documentId, values: changed });
    if (!result.ok) {
      if ('conflict' in result && result.conflict) {
        onConflict(result as Conflict);
        return;
      }
      const fieldErrors = 'fieldErrors' in result ? result.fieldErrors : undefined;
      for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
        const message = messages?.[0];
        if (message && controlImplementationWritableFields.includes(field as keyof ControlImplementationCreateInput)) form.setError(field as keyof ControlImplementationCreateInput, { message });
      }
      setError(result.formError);
      return;
    }
    const merged = mergeImplementation(implementation, normalized, result.data, options);
    if (!merged) {
      setError(controlUnavailableMessage);
      return;
    }
    onChanged(merged);
  }

  return (
    <form aria-label={mode === 'create' ? 'Add mitigation control' : 'Edit mitigation control'} className="grid max-w-[640px] gap-5 rounded-lg border border-border bg-surface-muted p-4" noValidate onSubmit={form.handleSubmit(submit)}>
      {error ? <Alert variant="destructive"><AlertTitle>Mitigation control not changed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
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
          pageSize={controlPickerPageSize}
          search={options.searchControls}
          searchingText="Searching controls…"
          suggested={applicableControlGroup(options.riskTypes, riskTypeId)}
          value={selectedControl}
        />
        <FieldError id={controlErrorId} message={form.formState.errors.control?.message} />
      </div>
      <SelectField error={form.formState.errors.controlOwner?.message} label="Control owner" name="controlOwner" options={options.users.map((user) => ({ label: user.displayName, value: user.documentId }))} register={form.register} />
      <SelectField error={form.formState.errors.controlStatus?.message} label="Control status" name="controlStatus" options={['Existing', 'Planned', 'Implemented', 'Retired'].map((value) => ({ label: value, value }))} register={form.register} />
      <SelectField error={form.formState.errors.effectivenessRating?.message} label="Effectiveness rating" name="effectivenessRating" options={['Effective', 'Partially Effective', 'Ineffective', 'Not Assessed'].map((value) => ({ label: value, value }))} register={form.register} />
      <label className="grid gap-2"><span className="text-sm font-medium">Evidence</span><Textarea aria-describedby="evidence-error" aria-invalid={Boolean(form.formState.errors.evidence)} {...form.register('evidence', { maxLength: { value: 65_535, message: 'Evidence must be 65,535 characters or fewer.' } })} /><FieldError id="evidence-error" message={form.formState.errors.evidence?.message} /></label>
      {([['implementationDueDate', 'Implementation due date'], ['implementedDate', 'Implemented date'], ['reviewDate', 'Review date']] as const).map(([name, label]) => <label className="grid gap-2" key={name}><span className="text-sm font-medium">{label}</span><Input aria-describedby={`${name}-error`} aria-invalid={Boolean(form.formState.errors[name])} type="date" {...form.register(name)} /><FieldError id={`${name}-error`} message={form.formState.errors[name]?.message} /></label>)}
      <div className="flex flex-wrap gap-3"><Button type="submit">Save mitigation control</Button><Button type="button" variant="outline" onClick={onCancel}>Discard mitigation changes</Button></div>
    </form>
  );
}

type SelectName = 'controlOwner' | 'controlStatus' | 'effectivenessRating';
function SelectField({ error, label, name, options, register }: { error?: string; label: string; name: SelectName; options: readonly { label: string; value: string }[]; register: ReturnType<typeof useForm<ControlImplementationCreateInput>>['register'] }) {
  return <label className="grid gap-2"><span className="text-sm font-medium">{label}</span><select aria-describedby={`${name}-error`} aria-invalid={Boolean(error)} className="h-9 rounded-md border border-input bg-surface px-3 text-sm" {...register(name)}><option value="">Not specified</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><FieldError id={`${name}-error`} message={error} /></label>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return <span className="min-h-0 text-sm text-destructive" id={id}>{message ? <><AlertCircleIcon aria-hidden="true" className="mr-1 inline size-4" />{message}</> : null}</span>;
}

function formatDate(value: string | null): string | null {
  return value ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`)) : null;
}

function Value({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return <div className={wide ? 'md:col-span-2' : undefined}><dt className="text-sm font-semibold text-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{value || 'Not provided'}</dd></div>;
}
