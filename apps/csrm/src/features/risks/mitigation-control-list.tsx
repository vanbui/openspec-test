'use client';

import { AlertCircleIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { controlImplementationWritableFields } from '@/features/assessments/assessment-domain';
import type {
  ControlImplementationCreateInput,
  ControlImplementationUpdateInput,
} from '@/features/assessments/assessment-schema';
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
};

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

function mergeImplementation(current: Mitigation | undefined, values: ControlImplementationCreateInput, result: Record<string, unknown>, options: RiskDetailsOptions): Mitigation {
  const control = options.controls.find((item) => item.documentId === values.control) ?? current?.control;
  if (!control) throw new Error('The selected reusable Control is unavailable.');
  const owner = options.users.find((item) => item.documentId === values.controlOwner) ?? null;
  return {
    documentId: typeof result.documentId === 'string' ? result.documentId : current?.documentId ?? '',
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

export function MitigationControlList({ implementations, mutable, onChanged, onConflict, options, riskId }: MitigationControlListProps) {
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
          <p className="text-sm text-muted-foreground">Add a reusable Control implementation to record how this Risk is mitigated.</p>
        </div>
      ) : null}
      {implementations.map((implementation) => (
        <article className="grid gap-4 rounded-lg border border-border p-4" key={implementation.documentId}>
          {mode?.kind === 'edit' && mode.id === implementation.documentId && options ? (
            <MitigationControlEditor implementation={implementation} mode="edit" onCancel={() => setMode(null)} onChanged={(updated) => { setMode(null); onChanged(implementations.map((item) => item.documentId === updated.documentId ? updated : item), 'Mitigation control changes saved.'); }} onConflict={onConflict} options={options} riskId={riskId} />
          ) : (
            <>
              <h3 className="text-heading-sm">{implementation.control.controlNumber} — {implementation.control.name}</h3>
              <dl className="grid gap-4 md:grid-cols-2">
                <Value label="Reusable control" value={`${implementation.control.controlNumber} — ${implementation.control.name}`} />
                <Value label="Control owner" value={implementation.controlOwner?.displayName} />
                <Value label="Control status" value={implementation.controlStatus} />
                <Value label="Effectiveness rating" value={implementation.effectivenessRating} />
                <Value label="Evidence" value={implementation.evidence} wide />
                <Value label="Implementation due date" value={formatDate(implementation.implementationDueDate)} />
                <Value label="Implemented date" value={formatDate(implementation.implementedDate)} />
                <Value label="Review date" value={formatDate(implementation.reviewDate)} />
              </dl>
              {mutable && options ? <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => setMode({ kind: 'edit', id: implementation.documentId })}>Edit mitigation control</Button><ConfirmDialog cancelLabel="Keep mitigation control" confirmLabel="Remove mitigation control" confirmVariant="destructive" description="This removes the contextual implementation from this Risk. The reusable Control remains in the library." errorMessage={removeErrors[implementation.documentId]} onConfirm={() => remove(implementation)} pendingLabel="Removing mitigation control…" title="Remove this mitigation control?" trigger={<Button type="button" variant="outline">Remove mitigation control</Button>} /></div> : null}
            </>
          )}
        </article>
      ))}
      {mutable && options && mode === null ? <Button ref={addRef} className="w-fit" type="button" onClick={() => setMode({ kind: 'create' })}>Add mitigation control</Button> : null}
      {mutable && options && mode?.kind === 'create' ? <MitigationControlEditor mode="create" onCancel={() => setMode(null)} onChanged={(created) => { setMode(null); onChanged([...implementations, created], 'Mitigation control added.'); }} onConflict={onConflict} options={options} riskId={riskId} /> : null}
    </div>
  );
}

function MitigationControlEditor({ implementation, mode, onCancel, onChanged, onConflict, options, riskId }: {
  implementation?: Mitigation;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onChanged: (implementation: Mitigation) => void;
  onConflict: (result: Conflict) => void;
  options: RiskDetailsOptions;
  riskId: string;
}) {
  const initial = useMemo(() => implementation ? valuesFor(implementation) : emptyValues, [implementation]);
  const form = useForm<ControlImplementationCreateInput>({ defaultValues: initial, mode: 'onBlur' });
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const controls = options.controls.filter((control) => `${control.controlNumber} ${control.name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  async function submit(raw: ControlImplementationCreateInput) {
    setError(null);
    const normalized = normalize(raw);
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
    onChanged(mergeImplementation(implementation, normalized, result.data as unknown as Record<string, unknown>, options));
  }

  return (
    <form aria-label={mode === 'create' ? 'Add mitigation control' : 'Edit mitigation control'} className="grid max-w-[640px] gap-5 rounded-lg border border-border bg-surface-muted p-4" noValidate onSubmit={form.handleSubmit(submit)}>
      {error ? <Alert variant="destructive"><AlertTitle>Mitigation control not changed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      <label className="grid gap-2"><span className="text-sm font-medium">Search reusable Controls</span><Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="grid gap-2"><span className="text-sm font-medium">Reusable control</span><select aria-describedby="control-error" aria-invalid={Boolean(form.formState.errors.control)} className="h-9 rounded-md border border-input bg-surface px-3 text-sm" {...form.register('control', { required: 'Select a reusable Control.' })}><option value="">Select a control</option>{controls.map((control) => <option key={control.documentId} value={control.documentId}>{control.controlNumber} — {control.name}</option>)}</select><FieldError id="control-error" message={form.formState.errors.control?.message} /></label>
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
