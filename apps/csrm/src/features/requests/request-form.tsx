'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { FormSection } from '@/components/csrm/form-section';
import { DetailSection } from '@/components/csrm/detail-section';
import { LocalInstant } from '@/components/csrm/local-time';
import { GuardedLink, useLeaveGuard } from '@/components/csrm/navigation-guard';
import { RecordLink } from '@/components/csrm/record-link';
import { StatusBadge } from '@/components/csrm/status-badge';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { SaveStatus, type SaveStatusValue } from '@/components/csrm/save-status';
import { filesCopy, filesIntakeCopy, filesNotAddedAlert, requestLeaveCopy, savedRequestLeaveCopy } from '@/features/attachments/attachments-domain';
import { useFilesInFlight, useKeptFiles } from '@/features/attachments/file-store';
import { FilesPanel, type FilesSectionProps } from '@/features/attachments/files-section';
import { UploadQueue, type UploadQueueHandle } from '@/features/attachments/upload-queue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createRequestAction, searchInformationAssetsAction, searchInformationSystemsAction, submitRequestAction, updateRequestAction, type RequestActionResult } from './request-actions';
import { RelationMultiSelect, type RelationSearchInput, type RelationSearchResult, type RelationSelection } from '../assessments/owner-combobox';
import { type RequestAssessmentRelation, type RequestQuestionnaireRelation, type RequestRelationSummary } from './request-domain';
import { requestDraftSchema, type RequestDraftInput, type RequestMutationResult } from './request-schema';
import { SubmitDescription, useSubmitFiles } from './request-workflow-actions';

export type RequestFormProps = {
  assets: readonly RequestRelationSummary[];
  defaultValues?: Partial<RequestDraftInput>;
  documentId?: string;
  /** The signed-in person's opaque key (server-only `draftOwnerKey`): keys the tab's file store. No key, no files. */
  draftOwnerKey?: string | null;
  /** The draft's Files section, as its request page reads it (edit only; `filesSectionFor`, D-18). */
  files?: FilesSectionProps | null;
  mode: 'create' | 'edit';
  systems: readonly RequestRelationSummary[];
};

/** A request may hold 20 files; a new request holds none yet (D-10). */
const NEW_REQUEST_FILE_ROOM = 20;

const emptyValues: RequestDraftInput = {
  title: '', description: '', assessmentType: undefined, division: '', businessUnit: '',
  businessPurpose: '', businessCriticality: undefined, thirdPartyInvolvement: false,
  thirdPartyDetails: '', regulatoryRequirements: '', dueDate: undefined,
  informationSystems: [], informationAssets: [],
};

function applyActionFailure(
  result: Extract<RequestActionResult, { ok: false }>,
  setError: ReturnType<typeof useForm<RequestDraftInput>>['setError'],
  setFormError: (message: string | null) => void,
) {
  for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
    const message = messages?.[0];
    if (message && field in emptyValues) setError(field as keyof RequestDraftInput, { message });
  }
  setFormError(result.formError ?? 'Check the highlighted fields and try again.');
}

function TextField({ name, label, description, multiline = false }: {
  name: keyof RequestDraftInput;
  label: string;
  description: string;
  multiline?: boolean;
}) {
  return (
    <FormField name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          {multiline
            ? <Textarea {...field} value={String(field.value ?? '')} />
            : <Input {...field} value={String(field.value ?? '')} />}
        </FormControl>
        <FormDescription>{description}</FormDescription>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function ChoiceField({ name, label, description, options }: {
  name: 'assessmentType' | 'businessCriticality';
  label: string;
  description: string;
  options: readonly string[];
}) {
  return (
    <FormField name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <select
            className="h-9 w-full rounded-md border border-input bg-surface px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            name={field.name}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(event.target.value || undefined)}
            ref={field.ref}
            value={field.value ?? ''}
          >
            <option value="">Not specified</option>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FormControl>
        <FormDescription>{description}</FormDescription>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function RelationField({ name, label, description, options, searchRelations }: {
  name: 'informationSystems' | 'informationAssets';
  label: string;
  description: string;
  options: readonly RequestRelationSummary[];
  searchRelations: (input: RelationSearchInput) => Promise<RelationSearchResult>;
}) {
  const [selections, setSelections] = useState<readonly RelationSelection[]>(options);

  return (
    <FormField name={name} render={({ field }) => (
      <FormItem>
        {/* The legend names the group; a matching aria-label would only repeat it. */}
        <FormControl><fieldset className="grid gap-3 rounded-md border border-input p-4">
          <legend className="px-1 text-sm font-medium">{label}</legend><FormDescription>{description}</FormDescription>
          <RelationMultiSelect
            label={label}
            searchLabel={`Search ${label.toLowerCase()}`}
            searchRelations={searchRelations}
            value={selections.filter((selection) => field.value?.includes(selection.documentId))}
            onValueChange={(selected) => {
              // Selections have to be remembered here rather than derived from
              // the initially rendered page: an item found by searching is not
              // in that page, so deriving would drop it from the display while
              // leaving its identifier in the submitted value.
              setSelections((current) => {
                const merged = new Map(current.map((item) => [item.documentId, item]));
                for (const item of selected) merged.set(item.documentId, item);
                return [...merged.values()];
              });
              field.onChange(selected.map((item) => item.documentId));
            }}
          />
        </fieldset></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

export function RequestForm({ assets, defaultValues, documentId, draftOwnerKey = null, files = null, mode, systems }: RequestFormProps) {
  const formRouter = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<RequestMutationResult | null>(null);
  /* The draft this form saves: the edit form's, or the one the new-request form's first save created (UI-D3). */
  const [draftId, setDraftId] = useState<string | null>(mode === 'edit' ? documentId ?? null : null);
  /* `adding` while the queue sends the files after a save (§2.2), and until the page moves on. */
  const [phase, setPhase] = useState<'idle' | 'adding'>('idle');
  const [saveStatus, setSaveStatus] = useState<SaveStatusValue>({ kind: 'idle' });
  const queue = useRef<UploadQueueHandle>(null);
  /* §2.2: shown after a save whose files were not all added, and focused each time a save ends that way. */
  const [notAddedSaves, setNotAddedSaves] = useState(0);
  const notAddedAlert = useRef<HTMLDivElement>(null);
  const notAddedId = useId();
  const focusInvalidAfterDialog = useRef(false);
  const form = useForm<RequestDraftInput>({
    defaultValues: { ...emptyValues, ...defaultValues },
    mode: 'onBlur',
    resolver: zodResolver(requestDraftSchema),
  });
  const ownerKey = draftOwnerKey ?? '';
  /* The draft's files not added, kept for the tab (§1.5), and its files on their way, from the tab's file store. */
  const kept = useKeptFiles(ownerKey, draftId ?? '', 'draft');
  const filesInFlight = useFilesInFlight(ownerKey, draftId ?? '');
  const submitFiles = useSubmitFiles(draftOwnerKey, documentId ?? '');

  /*
   * §10: the new-request form's own leave warning while it holds unsaved fields. Files chosen before the draft exists
   * are the queue's to guard (in the same words); once a file is on its way the queue asks in the files' words, and a
   * file not added is kept for the tab, so neither asks here. Once the first save has created the draft, only the changes
   * since would be lost, and the words say so (IN-502).
   */
  useLeaveGuard(mode === 'create' && phase === 'idle' && filesInFlight === 0 && form.formState.isDirty, 'waiting', draftId === null ? requestLeaveCopy : savedRequestLeaveCopy);

  useEffect(() => {
    if (notAddedSaves > 0) notAddedAlert.current?.focus();
  }, [notAddedSaves]);

  /*
   * 14-UI-SPEC §2.2 (D-26; UI-D3). Without files to send, Save draft saves as it always has and the action moves to the
   * draft. With files, the save stays on the page: the first save creates the draft and the address becomes its edit
   * route without a navigation, so a reload lands on the draft and saving again only updates it. The queue then sends
   * the files one at a time, and the page moves to the draft once every file is added or waiting for the malware check.
   */
  async function saveDraft(values: RequestDraftInput) {
    setFormError(null);
    if (phase !== 'idle') return;
    /* The fields as saved, so the leave warning only asks about changes made after this save (§10). */
    const savedFields = structuredClone(form.getValues());
    const creating = mode === 'create' && draftId === null;
    const saved = draftId ?? documentId;
    if (!queue.current?.hasWork()) {
      const result = creating
        ? await createRequestAction(values)
        : await updateRequestAction({ documentId: saved, ...values });
      if (result?.ok === false) applyActionFailure(result, form.setError, setFormError);
      return;
    }

    const result = creating
      ? await createRequestAction(values, { stayOnPage: true })
      : await updateRequestAction({ documentId: saved, ...values }, { stayOnPage: true });
    if (!result || result.ok === false) {
      if (result) applyActionFailure(result, form.setError, setFormError);
      return;
    }
    const savedId = result.data.documentId;
    /*
     * WR-504: the queue as it is now that the save has answered, never the handle taken before it: a file may have been
     * added or refused while the save was on its way, and a stale handle would wait for it forever.
     */
    const current = queue.current;
    if (creating) {
      setDraftId(savedId);
      window.history.replaceState(null, '', `/app/requests/${encodeURIComponent(savedId)}/edit`);
    }
    form.reset(savedFields, { keepValues: true, keepIsSubmitted: true, keepSubmitCount: true });
    setSaveStatus({ kind: 'saved', at: new Date().toISOString() });
    if (!current) return;
    setPhase('adding');
    const settled = await current.sendAll(savedId);
    if (settled.notAdded === 0) {
      formRouter.replace(`/app/requests/${encodeURIComponent(savedId)}`);
      return;
    }
    /* §2.2 (UI-D29): the page stays; the alert says what to do, and the files not added stay listed here and kept. */
    setPhase('idle');
    setNotAddedSaves((saves) => saves + 1);
  }

  async function submitDraft() {
    if (!documentId || !(await form.trigger())) {
      setFormError('Check the highlighted fields before submitting this request.');
      focusInvalidAfterDialog.current = true;
      throw new Error('Submission validation failed');
    }
    setFormError(null);
    const result = await submitRequestAction({ documentId, ...form.getValues() });
    if (!result.ok) {
      applyActionFailure(result, form.setError, setFormError);
      toast.error(result.formError ?? 'Check the request and try again.');
      throw new Error('Submission failed');
    }
    setSubmittedResult(result.data);
    submitFiles.clearKept();
    toast.success('Request submitted.');
    /*
     * Submitting is only offered from the edit route, and a submitted request
     * may no longer be edited, so staying put drops the person onto that
     * route's own permission-denied screen the moment it revalidates. Send them
     * to the request they just submitted instead.
     */
    if (documentId) formRouter.push(`/app/requests/${encodeURIComponent(documentId)}`);
  }

  const isSubmitted = submittedResult?.requestStatus === 'submitted';
  /* WR-504: while Save draft is on its way, from the first check to the last file settled, the queue takes no change. */
  const saving = form.formState.isSubmitting || phase !== 'idle';
  /* §2.2: the alert above the queue while the draft holds files not added after a save. */
  const alert = notAddedSaves > 0 && draftId !== null && kept.length > 0 ? filesNotAddedAlert(kept.length) : null;
  const notAddedNotice = alert && draftId !== null ? (
    /*
     * IN-503 (§2.2 "announced once"): a group named by its title, which the focus move announces, not a live alert, so a
     * recount as rows are retried or removed is not announced again.
     */
    <Alert aria-describedby={`${notAddedId}-description`} aria-labelledby={`${notAddedId}-title`} className="gap-y-2" ref={notAddedAlert} role="group" tabIndex={-1} variant="destructive">
      <AlertTitle id={`${notAddedId}-title`}>{alert.title}</AlertTitle>
      <AlertDescription id={`${notAddedId}-description`}>{alert.description}</AlertDescription>
      <div className="col-start-2 pt-1">
        {/* O8 (direction §4 Buttons): a phone action at full width and the touch-target height below 768px. */}
        <GuardedLink className={buttonVariants({ variant: 'outline', size: 'sm', className: 'max-md:min-h-11 max-md:w-full' })} href={`/app/requests/${encodeURIComponent(draftId)}`}>{filesIntakeCopy.goToDraft}</GuardedLink>
      </div>
    </Alert>
  ) : null;

  return (
    <Form {...form}>
      <form className="grid w-full max-w-2xl grid-cols-1 gap-8" noValidate onSubmit={form.handleSubmit(saveDraft)}>
        {formError ? <Alert variant="destructive"><AlertTitle>Request not saved</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
        {isSubmitted ? (
          <Alert>
            <AlertTitle><StatusBadge live status="submitted" /></AlertTitle>
            <AlertDescription>Submitted <LocalInstant style="date" value={submittedResult.submittedDate} />. You can return it to draft from the request page until a Security Analyst starts work on it.</AlertDescription>
          </Alert>
        ) : null}
        <FormSection description="Name the request and explain why the assessment is needed." title="Request overview">
          <TextField description="Use a concise name that others can recognise." label="Request title" name="title" />
          <TextField description="Summarise the proposed change or service." label="Description" multiline name="description" />
          <ChoiceField description="Choose the closest assessment category." label="Assessment type" name="assessmentType" options={['BAU', 'Project', 'Other']} />
          <TextField description="Organisation division responsible for this request." label="Division" name="division" />
          <TextField description="Business unit responsible for this request." label="Business unit" name="businessUnit" />
        </FormSection>
        <FormSection description="Describe business importance and external obligations." title="Business context">
          <TextField description="Explain the intended business outcome." label="Business purpose" multiline name="businessPurpose" />
          <ChoiceField description="Select the impact if the service is disrupted." label="Business criticality" name="businessCriticality" options={['Low', 'Moderate', 'High', 'Critical']} />
          <FormField name="thirdPartyInvolvement" render={({ field }) => (
            <FormItem>
              <label className="flex min-h-9 items-center gap-3 text-sm font-medium">
                <FormControl><Checkbox checked={field.value ?? false} name={field.name} onBlur={field.onBlur} onCheckedChange={field.onChange} ref={field.ref} /></FormControl>
                Third-party involvement
              </label>
              <FormDescription>Select when an external organisation provides or accesses the service.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          <TextField description="Identify the third party and its role." label="Third-party details" multiline name="thirdPartyDetails" />
          <TextField description="List applicable legislation, standards, or contractual obligations." label="Regulatory requirements" multiline name="regulatoryRequirements" />
        </FormSection>
        <FormSection description="Set timing and connect authorised inventory records." title="Scope and timing">
          <FormField name="dueDate" render={({ field }) => (
            <FormItem><FormLabel>Due date</FormLabel><FormControl><Input {...field} type="date" value={field.value ?? ''} /></FormControl><FormDescription>Optional target date for completing the assessment.</FormDescription><FormMessage /></FormItem>
          )} />
          <RelationField description="Search and select every system included in the assessment scope." label="Information systems" name="informationSystems" options={systems} searchRelations={searchInformationSystemsAction} />
          <RelationField description="Search and select every information asset included in scope." label="Information assets" name="informationAssets" options={assets} searchRelations={searchInformationAssetsAction} />
          <p className="text-sm text-muted-foreground">Sponsor selection is not available in CSRM.</p>
        </FormSection>
        {/*
          * 14-UI-SPEC §2.1 and §2.3 (D-27): files with the request. On the new-request form they wait for Save draft; on
          * the draft's edit form the draft's own list and field render, and a chosen file is added at once (UI-D4).
          */}
        {mode === 'create' && draftOwnerKey !== null ? (
          <FormSection description={filesIntakeCopy.createDescription} title={filesIntakeCopy.title}>
            {notAddedNotice}
            <UploadQueue disabled={saving} label={filesCopy.addFiles} leaveCopy={requestLeaveCopy} mode="deferred" ownerKey={draftOwnerKey} ref={queue} remaining={NEW_REQUEST_FILE_ROOM} scope="draft" />
          </FormSection>
        ) : null}
        {mode === 'edit' && files ? (
          <FormSection description={filesIntakeCopy.editDescription} title={filesIntakeCopy.title}>
            {notAddedNotice}
            <FilesPanel {...files} queueDisabled={saving} queueRef={queue} />
          </FormSection>
        ) : null}
        {!isSubmitted ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <Button disabled={saving} type="submit">
              {phase === 'adding'
                ? <><Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />{filesIntakeCopy.addingFiles}</>
                : form.formState.isSubmitting ? 'Saving draft…' : 'Save draft'}
            </Button>
            {mode === 'edit' ? (
              <ConfirmDialog
                confirmDisabled={submitFiles.waiting}
                confirmLabel="Submit request"
                confirmVariant="default"
                description={<SubmitDescription line={submitFiles.line} />}
                errorMessage={formError}
                onConfirm={submitDraft}
                onDismiss={() => {
                  if (focusInvalidAfterDialog.current) {
                    focusInvalidAfterDialog.current = false;
                    setTimeout(() => form.setFocus('title'), 0);
                  }
                }}
                pendingLabel="Submitting request…"
                title="Submit this assessment request?"
                trigger={<Button type="button" variant="outline">Submit request</Button>}
              />
            ) : null}
            {/* X-1: the draft's save, while the page stays to add its files (§2.2). */}
            <SaveStatus savedLabel={(time) => <>Draft saved at {time}</>} status={saveStatus} />
          </div>
        ) : null}
      </form>
    </Form>
  );
}

const ratingOrder = ['Low', 'Moderate', 'High', 'Critical'] as const;

export function AssessmentRelationshipTile({ assessment, assessmentHref }: { assessment?: RequestAssessmentRelation; assessmentHref?: string }) {
  if (!assessmentHref || !assessment || assessment.availability !== 'available') return null;
  return (
    <Card className="relative transition-transform duration-150 hover:-translate-y-px hover:border-foreground/30">
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Risks by residual rating
        </p>
        <CardTitle>
          <RecordLink
            className="inline-flex min-h-11 items-center text-text-link underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:inset-0 after:content-['']"
            href={assessmentHref}
          >
            {assessment.assessmentNumber ?? 'Risk assessment'}
          </RecordLink>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Open risk assessment</p>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-2 min-[560px]:grid-cols-4">
          {ratingOrder.map((rating) => (
            <div className="flex items-center justify-between gap-2" key={rating}>
              <dt><RiskRatingBadge rating={rating} /></dt>
              <dd
                aria-label={`${rating} residual Risks: ${assessment.residualRiskCounts[rating]}`}
                className="font-medium tabular-nums"
              >
                {assessment.residualRiskCounts[rating]}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function RequestRelationships({ assessment, assessmentHref, questionnaire, questionnaireHref }: { assessment: RequestAssessmentRelation; assessmentHref?: string; questionnaire: RequestQuestionnaireRelation; questionnaireHref?: string }) {
  const showQuestionnaire = questionnaire.availability === 'absent' || (questionnaire.availability === 'available' && Boolean(questionnaireHref));
  const showAssessment = assessment.availability === 'available' && Boolean(assessmentHref);
  if (!showQuestionnaire && !showAssessment) return null;
  return (
    <DetailSection
      description="Related records are shown only when they are authorised for this request."
      title="Questionnaire and assessment"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {showQuestionnaire ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Questionnaire</CardTitle></CardHeader>
            <CardContent>
              {questionnaire.availability === 'available' && questionnaireHref ? (
                <div className="space-y-1">
                  <RecordLink
                    className="inline-flex min-h-11 items-center text-text-link underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={questionnaireHref}
                  >
                    {questionnaire.title ?? questionnaire.questionnaireNumber ?? 'Questionnaire'}
                  </RecordLink>
                  <p className="text-sm text-muted-foreground">{questionnaire.state ?? 'State not recorded'}</p>
                </div>
              ) : null}
              {questionnaire.availability === 'absent' ? (
                <Alert>
                  <AlertTitle>No questionnaire is linked</AlertTitle>
                  <AlertDescription>A questionnaire will appear here when one is created for this request.</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        <AssessmentRelationshipTile assessment={assessment} assessmentHref={assessmentHref} />
      </div>
    </DetailSection>
  );
}
