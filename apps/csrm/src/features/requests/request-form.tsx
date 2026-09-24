'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { FormSection } from '@/components/csrm/form-section';
import { DetailSection } from '@/components/csrm/detail-section';
import { RecordLink } from '@/components/csrm/record-link';
import { StatusBadge } from '@/components/csrm/status-badge';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createRequestAction, revertRequestToDraftAction, searchInformationAssetsAction, searchInformationSystemsAction, submitRequestAction, updateRequestAction, type RequestActionResult } from './request-actions';
import { RelationMultiSelect, type RelationSearchInput, type RelationSearchResult, type RelationSelection } from '../assessments/owner-combobox';
import { canRequestorEdit, formatRequestDate, type CsrmAssessmentRequest, type RequestAssessmentRelation, type RequestQuestionnaireRelation, type RequestRelationSummary } from './request-domain';
import { toRequestFormValues } from './request-form-values';
import { requestDraftSchema, type RequestDraftInput, type RequestMutationResult } from './request-schema';

export type RequestFormProps = {
  assets: readonly RequestRelationSummary[];
  defaultValues?: Partial<RequestDraftInput>;
  documentId?: string;
  mode: 'create' | 'edit';
  systems: readonly RequestRelationSummary[];
};

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

export function RequestForm({ assets, defaultValues, documentId, mode, systems }: RequestFormProps) {
  const formRouter = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<RequestMutationResult | null>(null);
  const focusInvalidAfterDialog = useRef(false);
  const form = useForm<RequestDraftInput>({
    defaultValues: { ...emptyValues, ...defaultValues },
    mode: 'onBlur',
    resolver: zodResolver(requestDraftSchema),
  });

  async function saveDraft(values: RequestDraftInput) {
    setFormError(null);
    const result = mode === 'create'
      ? await createRequestAction(values)
      : await updateRequestAction({ documentId, ...values });
    if (result?.ok === false) applyActionFailure(result, form.setError, setFormError);
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

  return (
    <Form {...form}>
      <form className="grid w-full max-w-2xl grid-cols-1 gap-8" noValidate onSubmit={form.handleSubmit(saveDraft)}>
        {formError ? <Alert variant="destructive"><AlertTitle>Request not saved</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
        {isSubmitted ? (
          <Alert>
            <AlertTitle><StatusBadge live status="submitted" /></AlertTitle>
            <AlertDescription>Submitted {formatRequestDate(submittedResult.submittedDate)}. This request can no longer be edited.</AlertDescription>
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
          <p className="text-sm text-muted-foreground">Sponsor selection is unavailable until a least-privilege directory contract exists.</p>
        </FormSection>
        {!isSubmitted ? (
          <div className="flex flex-wrap gap-3 border-t border-border pt-6">
            <Button disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? 'Saving draft…' : 'Save draft'}</Button>
            {mode === 'edit' ? (
              <ConfirmDialog
                confirmLabel="Submit request"
                confirmVariant="default"
                description="Submission is irreversible. This request cannot be edited after submission."
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
          </div>
        ) : null}
      </form>
    </Form>
  );
}

export function RequestWorkflowActions({ request }: { request: CsrmAssessmentRequest }) {
  const [submitted, setSubmitted] = useState<RequestMutationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = submitted?.requestStatus ?? request.requestStatus;
  const router = useRouter();

  async function revert(reason?: string) {
    const result = await revertRequestToDraftAction({ documentId: request.documentId, reason });
    if (!result.ok) { setError(result.formError ?? 'The request could not be reverted.'); throw new Error('Request revert failed'); }
    toast.success('Request returned to draft.');
    router.refresh();
  }

  if (!canRequestorEdit(status)) {
    const canRevert = status === 'submitted' && !request.questionnaire && !request.assessment;
    return <div className="grid gap-3">{canRevert ? <div className="mb-1"><ConfirmDialog confirmLabel="Return request to draft" confirmVariant="destructive" description="This returns the request to draft and clears its submitted date." errorMessage={error} onConfirm={revert} pendingLabel="Returning request to draft…" reasonRequired title="Return this request to draft?" trigger={<Button type="button">Return to draft</Button>} /></div> : null}<StatusBadge live={Boolean(submitted)} status={status} />{(submitted?.submittedDate ?? request.submittedDate) ? <p className="text-sm text-muted-foreground">Submitted {formatRequestDate(submitted?.submittedDate ?? request.submittedDate)}</p> : null}</div>;
  }

  async function submit() {
    setError(null);
    const result = await submitRequestAction({ documentId: request.documentId, ...toRequestFormValues(request) });
    if (!result.ok) {
      setError(result.formError ?? 'Check the request and try again.');
      toast.error(result.formError ?? 'Request submission failed.');
      throw new Error('Submission failed');
    }
    setSubmitted(result.data);
    toast.success('Request submitted.');
  }

  return (
    <div className="grid gap-3">
      {error ? <Alert variant="destructive"><AlertTitle>Request not submitted</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="flex flex-wrap gap-3">
        <Link className={buttonVariants({ variant: 'outline' })} href={`/app/requests/${request.documentId}/edit`}>Edit request</Link>
        <ConfirmDialog confirmLabel="Submit request" confirmVariant="default" description="Submission is irreversible. This request cannot be edited after submission." errorMessage={error} onConfirm={submit} pendingLabel="Submitting request…" title="Submit this assessment request?" trigger={<Button type="button">Submit request</Button>} />
      </div>
    </div>
  );
}

const ratingOrder = ['Low', 'Moderate', 'High', 'Critical'] as const;

export function AssessmentRelationshipTile({ assessment, assessmentHref }: { assessment?: RequestAssessmentRelation; assessmentHref?: string }) {
  if (!assessmentHref || !assessment || assessment.availability !== 'available') return null;
  return (
    <Card className="relative transition-transform duration-150 hover:-translate-y-px hover:border-foreground/30">
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Contextual Risks by residual rating
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
                aria-label={`${rating} residual contextual risks: ${assessment.residualRiskCounts[rating]}`}
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
