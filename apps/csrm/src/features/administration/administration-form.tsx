'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { DetailSection } from '@/components/csrm/detail-section';
import { FormSection } from '@/components/csrm/form-section';
import { nativeSelectClassName } from '@/components/csrm/native-select';
import { PageHeader } from '@/components/csrm/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { OwnerCombobox, type OwnerSearchResult } from '@/features/assessments/owner-combobox';
import type { ActiveUser } from '@/features/assessments/assessment-schema';
import { controlLabel } from '@/features/assessments/control-label';
import type { AdministrationActionResult } from './administration-actions';
import type { ApplicableControlOption } from './applicable-controls';
import { administrationSearchDelayMs, getAdministrationConfig, type AdministrationKind } from './administration-config';
import {
  controlTypeValues,
  dataClassificationValues,
  deploymentModelValues,
  lifecycleStateValues,
  systemEnvironmentValues,
} from './administration-domain';
import {
  controlCreateInputSchema,
  informationAssetCreateInputSchema,
  informationSystemCreateInputSchema,
  riskTypeCreateInputSchema,
  type AdministrationRecord,
  type ControlCreateInput,
  type InformationAssetCreateInput,
  type InformationSystemCreateInput,
  type RiskTypeCreateInput,
} from './administration-schema';

/*
 * The Administration create and edit form. It validates with the collections' zod input schemas in
 * the browser, so it lives apart from the lists in administration-workspace.tsx: only the create and
 * record pages, which render it, download zod (plan 08-13, D-24).
 */

type Action = (input: unknown) => Promise<AdministrationActionResult<AdministrationRecord>>;
type FormValues = Partial<RiskTypeCreateInput & ControlCreateInput & InformationSystemCreateInput & InformationAssetCreateInput> & { name: string; description?: string | null };

export type AdministrationFormProps = {
  kind: AdministrationKind;
  mode: 'create' | 'edit';
  documentId?: string;
  /** `ownerName` is the Information System owner's served display name; it seeds the owner combobox and is never submitted. */
  initialValues?: Partial<FormValues> & { ownerName?: string | null };
  createAction?: Action;
  updateAction?: Action;
  searchControls?: (input: unknown) => Promise<readonly ApplicableControlOption[]>;
  initialControlOptions?: readonly ApplicableControlOption[];
  searchOwners?: (input: { search: string }) => Promise<OwnerSearchResult>;
};

/*
 * An optional text field left blank, or holding only spaces, is empty: it submits null, the value the
 * collections accept for "not provided", and never raises a validation error (WR-04).
 */
function optionalText(value: string): string | null {
  return value.trim() ? value : null;
}

/* What each form is for, in the direction's voice (D-38, UI-SPEC §17.1). */
function formDescription(kind: AdministrationKind, mode: 'create' | 'edit'): string {
  if (kind === 'controls') return mode === 'create' ? 'Add a control to the library.' : 'Edit this control. Mitigation controls on Risks keep their own status and evidence.';
  if (kind === 'information-systems') return 'Manage this organisational Information System for assessment workflows.';
  if (kind === 'information-assets') return 'Manage this organisational Information Asset for assessment workflows.';
  return mode === 'create' ? 'Create a Risk Type for use in future assessments.' : 'Edit this Risk Type. Risks already identified keep their own details.';
}

/* What happens to the records that use this one when it changes: nothing is deleted or rewritten. */
function downstreamUse(kind: AdministrationKind, label: string): { description: string; body: string } {
  if (kind === 'controls') return {
    description: 'Mitigation controls on Risks keep their own assessment history.',
    body: 'This control may be used by Risk Types and by mitigation controls on Risks. Nothing is deleted or changed automatically.',
  };
  if (kind === 'risk-types') return {
    description: 'Risks already identified keep their own assessment history.',
    body: 'Applicable controls suggest controls for this Risk Type only. Nothing is deleted or changed automatically.',
  };
  return {
    description: 'Assessments and Risks keep their own history.',
    body: `This ${label} may be used in assessments. Nothing is deleted or changed automatically.`,
  };
}

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
  // A saved selection reads by the label its page supplied, never by its id (D-36, UI-SPEC §16.2).
  const [selectedControlLabels, setSelectedControlLabels] = useState<Record<string, string>>(
    () => Object.fromEntries(initialControlOptions.map((option) => [option.documentId, option.label])),
  );
  // The owner shows by its served name, never its id (D-37, UI-SPEC §16.4).
  const [selectedOwner, setSelectedOwner] = useState<ActiveUser | null>(() => typeof initialValues?.owner === 'string'
    ? { documentId: initialValues.owner, displayName: initialValues.ownerName?.trim() || 'Name not available' }
    : null);
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
  const downstream = downstreamUse(kind, config.label);
  return (
    <div className="space-y-8">
      <PageHeader
        description={formDescription(kind, mode)}
        title={mode === 'create' ? `Create ${config.label}` : kind === 'controls' ? controlLabel({ controlNumber: initial.controlNumber ?? '', name: initial.name, framework: initial.framework }) : initial.name || config.label}
      />
      {mode === 'edit' ? <Button type="button" variant="outline" onClick={() => form.setFocus(kind === 'controls' ? 'controlNumber' : 'name')}>Edit {config.label}</Button> : null}
      {formError ? <Alert variant="destructive" role="alert"><AlertTitle>{config.label} could not be saved</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
      <Form {...form}>
        <form className="space-y-8" noValidate onSubmit={form.handleSubmit(submit)}>
          {kind === 'controls' ? <>
          <FormSection title="Identity" description="Identify this control and the framework it comes from.">
            <FormField control={form.control} name="controlNumber" render={({ field }) => <FormItem><FormLabel>Control number</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} aria-required="true" /></FormControl><FormDescription>Enter a unique Control number.</FormDescription><FormMessage /></FormItem>} />
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} aria-required="true" /></FormControl><FormDescription>Enter the control’s title without its number.</FormDescription><FormMessage /></FormItem>} />
            <FormField control={form.control} name="framework" render={({ field }) => <FormItem><FormLabel>Framework</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} aria-required="true" /></FormControl><FormDescription>Name the source framework.</FormDescription><FormMessage /></FormItem>} />
            <FormField control={form.control} name="frameworkVersion" render={({ field }) => <FormItem><FormLabel>Framework version</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
          </FormSection>
          <FormSection title="Definition" description="Describe what this control requires.">
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="controlType" render={({ field }) => <FormItem><FormLabel>Control type</FormLabel><FormControl><select className={`${nativeSelectClassName} w-full`} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)}><option value="">Not provided</option>{controlTypeValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="controlReference" render={({ field }) => <FormItem><FormLabel>Control reference</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="frameworkSource" render={({ field }) => <FormItem><FormLabel>Framework source</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
          </FormSection></> : kind === 'information-systems' ? <>
          <FormSection title="Identity" description="Identify this organisational Information System.">
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} aria-required="true" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="systemType" render={({ field }) => <FormItem><FormLabel>System type</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
          </FormSection>
          <FormSection title="Environment" description="Describe deployment and lifecycle facts.">
            <FormField control={form.control} name="environment" render={({ field }) => <FormItem><FormLabel>Environment</FormLabel><FormControl><select aria-label="Environment" className={`${nativeSelectClassName} w-full`} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)}><option value="">Not provided</option>{systemEnvironmentValues.map((value) => <option key={value}>{value}</option>)}</select></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="deploymentModel" render={({ field }) => <FormItem><FormLabel>Deployment model</FormLabel><FormControl><select aria-label="Deployment model" className={`${nativeSelectClassName} w-full`} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)}><option value="">Not provided</option>{deploymentModelValues.map((value) => <option key={value}>{value}</option>)}</select></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="hostingLocation" render={({ field }) => <FormItem><FormLabel>Hosting location</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="lifecycleState" render={({ field }) => <FormItem><FormLabel>Lifecycle state</FormLabel><FormControl><select aria-label="Lifecycle state" className={`${nativeSelectClassName} w-full`} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)}><option value="">Not provided</option>{lifecycleStateValues.map((value) => <option key={value}>{value}</option>)}</select></FormControl><FormMessage /></FormItem>} />
          </FormSection>
          <FormSection title="Exposure and ownership" description="Record criticality, exposure, and an active owner.">
            <FormField control={form.control} name="businessCriticality" render={({ field }) => <FormItem><FormLabel>Business criticality</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="internetFacing" render={({ field }) => <FormItem><FormControl><fieldset className="flex gap-4"><legend className="mb-2 text-sm font-medium">Internet-facing</legend><label><input checked={field.value === true} name="internetFacing" onChange={() => field.onChange(true)} type="radio" /> Yes, internet-facing</label><label><input checked={field.value === false} name="internetFacing" onChange={() => field.onChange(false)} type="radio" /> No, not internet-facing</label></fieldset></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="externalAccessRequired" render={({ field }) => <FormItem><FormControl><fieldset className="flex gap-4"><legend className="mb-2 text-sm font-medium">External access required</legend><label><input checked={field.value === true} name="externalAccessRequired" onChange={() => field.onChange(true)} type="radio" /> Yes</label><label><input checked={field.value === false} name="externalAccessRequired" onChange={() => field.onChange(false)} type="radio" /> No</label></fieldset></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="owner" render={({ field }) => <FormItem><FormControl><OwnerCombobox label="Owner" onValueChange={(owner) => { setSelectedOwner(owner); field.onChange(owner?.documentId ?? null); }} searchOwners={resolvedSearchOwners} value={selectedOwner} /></FormControl><FormMessage /></FormItem>} />
          </FormSection>
          </> : kind === 'information-assets' ? <>
          <FormSection title="Identity" description="Identify this organisational Information Asset.">
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} aria-required="true" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="type" render={({ field }) => <FormItem><FormLabel>Type</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="location" render={({ field }) => <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
          </FormSection>
          <FormSection title="Classification and assurance" description="Record classification and assurance ratings.">
            <FormField control={form.control} name="dataClassification" render={({ field }) => <FormItem><FormLabel>Data classification</FormLabel><FormControl><select className={`${nativeSelectClassName} w-full`} value={String(field.value ?? '')} onChange={(event) => field.onChange(event.target.value || null)}><option value="">Not provided</option>{dataClassificationValues.map((value) => <option key={value}>{value}</option>)}</select></FormControl><FormMessage /></FormItem>} />
            {(['confidentialityRating', 'integrityRating', 'availabilityRating'] as const).map((fieldName) => <FormField control={form.control} key={fieldName} name={fieldName} render={({ field }) => <FormItem><FormLabel>{fieldName === 'confidentialityRating' ? 'Confidentiality rating' : fieldName === 'integrityRating' ? 'Integrity rating' : 'Availability rating'}</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} />)}
          </FormSection>
          <FormSection title="Data characteristics" description="Identify sensitive data held by this Information Asset.">
            {([['containsPersonalData', 'Contains personal data'], ['containsLegalData', 'Contains legal data'], ['containsCreditCardData', 'Contains credit-card data']] as const).map(([fieldName, label]) => <FormField control={form.control} key={fieldName} name={fieldName} render={({ field }) => <FormItem><FormControl><fieldset className="flex gap-4"><legend className="mb-2 text-sm font-medium">{label}</legend><label><input checked={field.value === true} name={fieldName} onChange={() => field.onChange(true)} type="radio" /> Yes</label><label><input checked={field.value === false} name={fieldName} onChange={() => field.onChange(false)} type="radio" /> No</label></fieldset></FormControl><FormMessage /></FormItem>} />)}
          </FormSection>
          <FormSection title="Notes" description="Record supporting Information Asset notes."><FormField control={form.control} name="comments" render={({ field }) => <FormItem><FormLabel>Comments</FormLabel><FormControl><Textarea {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormMessage /></FormItem>} /></FormSection>
          </> : <>
          <FormSection title="Definition" description="Name and describe this Risk Type.">
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={String(field.value ?? '')} aria-required="true" /></FormControl><FormDescription>Enter a unique Risk Type name.</FormDescription><FormMessage /></FormItem>} />
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} value={String(field.value ?? '')} onChange={(event) => field.onChange(optionalText(event.target.value))} /></FormControl><FormDescription>Explain which risks this Risk Type covers.</FormDescription><FormMessage /></FormItem>} />
          </FormSection>
          <FormSection title="Applicable controls" description="Choose the controls that usually mitigate this Risk Type.">
            <FormField control={form.control} name="applicableControls" render={({ field }) => <FormItem><FormLabel>Applicable controls</FormLabel><FormControl><div className="space-y-3"><div className="flex gap-2"><Input aria-label="Applicable controls" aria-autocomplete="list" aria-controls={controlOptions.length ? 'applicable-control-options' : undefined} aria-expanded={controlOptions.length > 0} role="combobox" ref={controlSearchRef} onInput={(event) => handleControlInput(event.currentTarget.value)} /><Button type="button" variant="outline" onClick={() => void searchRemoteControls()}>Search controls</Button></div><p className="sr-only" role="status" aria-live="polite">{controlOptions.length} control options available.</p>{controlOptions.length ? <div className="rounded-lg border border-border bg-popover p-1" id="applicable-control-options" ref={controlOptionsRef} role="listbox">{controlOptions.filter((option) => !field.value?.includes(option.documentId)).map((option) => <button className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-muted" data-label={option.label} key={option.documentId} onClick={() => { field.onChange([...(field.value ?? []), option.documentId]); setSelectedControlLabels((labels) => ({ ...labels, [option.documentId]: option.label })); if (controlSearchRef.current) controlSearchRef.current.value = ''; }} role="option" type="button">{option.label}</button>)}</div> : null}<fieldset className="rounded-lg border border-border p-4"><legend className="px-1 text-sm font-medium">Selected applicable controls</legend>{field.value?.length ? field.value.map((controlId) => <label className="flex min-h-11 items-center gap-3 text-sm" key={controlId}><Checkbox checked onCheckedChange={(checked) => { if (!checked) field.onChange(field.value?.filter((id) => id !== controlId)); }} />{selectedControlLabels[controlId] ?? 'Control not found'}</label>) : <p className="text-sm text-muted-foreground">No applicable controls selected.</p>}</fieldset></div></FormControl><FormDescription>Search by control number, name or framework.</FormDescription><FormMessage /></FormItem>} />
          </FormSection>
          </>}
          <div className="flex flex-wrap gap-3">
            <Button disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? mode === 'create' ? 'Creating…' : 'Saving…' : mode === 'create' ? `Create ${config.label}` : 'Save changes'}</Button>
            {form.formState.isDirty ? <ConfirmDialog cancelLabel="Keep editing" confirmLabel="Discard changes" confirmVariant="destructive" description={`Your changes to this ${config.label} have not been saved.`} onConfirm={() => router.push(config.listPath)} pendingLabel="Discarding…" title="Discard unsaved changes?" trigger={returnLink} /> : returnLink}
          </div>
        </form>
      </Form>
      {mode === 'edit' ? <DetailSection title="Downstream use" description={downstream.description}><p className="text-sm text-muted-foreground">{downstream.body}</p></DetailSection> : null}
    </div>
  );
}
