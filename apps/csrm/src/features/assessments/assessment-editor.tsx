'use client';

import { AlertCircleIcon, CheckCircle2Icon, LockKeyholeIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { DetailSection } from '@/components/csrm/detail-section';
import { PageHeader } from '@/components/csrm/page-header';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { RequestRelationSummary } from '@/features/requests/request-domain';
import { refreshAnalystAssessmentAction, releaseAssessmentAction, saveAssessmentAction } from './assessment-actions';
import {
  type ActiveUser,
  type AnalystAssessmentDetail,
  type AssessmentUpdateInput,
  type Control,
  type ControlImplementation,
  type AnalystRisk,
  type RiskType,
  type RiskUpdateInput,
} from './assessment-schema';
import { ControlImplementationEditor } from './control-implementation-editor';
import { RiskEditor, type EditableRisk } from './risk-editor';
import type { OwnerSearchInput, OwnerSearchResult } from './owner-combobox';
import { assessmentStatusPresentation, releaseReadinessPresentation } from './assessment-domain';
import { AssessmentLifecycleStepper } from './assessment-lifecycle-stepper';
import { AssessmentRequestLink } from './assessment-request-link';

export type AssessmentEditorState = 'populated' | 'empty' | 'error' | 'permission';

export type AssessmentEditorProps = {
  assessment?: AnalystAssessmentDetail;
  assets?: readonly RequestRelationSummary[];
  controlImplementations?: Readonly<Record<string, readonly ControlImplementation[]>>;
  controls?: readonly Control[];
  risks?: readonly AnalystRisk[];
  riskTypes?: readonly RiskType[];
  state?: AssessmentEditorState;
  systems?: readonly RequestRelationSummary[];
  searchOwners?: (input: OwnerSearchInput) => Promise<OwnerSearchResult>;
};

function hasAnyReleaseFact(assessment: AnalystAssessmentDetail): boolean {
  return assessment.assessmentDate !== null || assessment.approvalDate !== null || assessment.approvedBy !== null;
}

function canMutateAssessment(assessment: AnalystAssessmentDetail): boolean {
  return (assessment.assessmentStatus === 'draft' || assessment.assessmentStatus === 'in-review')
    && !hasAnyReleaseFact(assessment);
}

/**
 * A drafted assessment that still carries a reviewer of record is a reviewed
 * assessment whose review a later edit withdrew (D-13). That combination is
 * unreachable for an assessment that was never reviewed, so it is the retained
 * evidence of the superseded review rather than a derived label.
 */
function hasSupersededReview(assessment: AnalystAssessmentDetail): boolean {
  return assessment.assessmentStatus === 'draft' && assessment.reviewedBy !== null;
}

function SupersededReviewNotice({ reviewerName }: { reviewerName?: string }) {
  return (
    <Alert aria-live="polite" className="border-warning-border bg-warning-subtle">
      <RotateCcwIcon aria-hidden="true" />
      <AlertTitle>Completed review withdrawn</AlertTitle>
      <AlertDescription>
        <p>
          {reviewerName
            ? `A later edit superseded the review completed by ${reviewerName}. That review stays recorded as the reviewer of record.`
            : 'A later edit superseded the completed review. The earlier review stays recorded but superseded.'}
        </p>
        <p>
          This assessment has returned to drafted. Save the assessment again to record a fresh review;
          it cannot be released until a fresh review is recorded.
        </p>
      </AlertDescription>
    </Alert>
  );
}

function SafeAssessmentState({ state }: { state: Exclude<AssessmentEditorState, 'populated'> }) {
  const permission = state === 'permission';
  const empty = state === 'empty';
  return (
    <div className="grid gap-5">
      <PageHeader description="Review an authorised risk assessment." title="Risk assessment review" />
      <Alert role={permission || state === 'error' ? 'alert' : undefined} variant={permission || state === 'error' ? 'destructive' : 'default'}>
        <AlertCircleIcon aria-hidden="true" />
        <AlertTitle>{permission ? 'You don’t have permission to review this assessment' : empty ? 'No assessment details are available' : 'We couldn’t load this assessment'}</AlertTitle>
        <AlertDescription>{permission ? 'Assessment access is enforced by your effective CSRM capabilities.' : empty ? 'Return to the assessment queue and choose another assessment.' : 'Try again. If the problem continues, contact your administrator.'}</AlertDescription>
      </Alert>
    </div>
  );
}

export function AssessmentEditorSkeleton() {
  return (
    <div aria-label="Loading risk assessment editor" className="grid gap-6" role="status">
      <span className="sr-only">Loading risk assessment editor</span>
      <div className="grid gap-2"><Skeleton className="h-8 w-2/3 max-w-lg" /><Skeleton className="h-4 w-1/3 max-w-xs" /></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"><Skeleton className="h-80 w-full" /><Skeleton className="h-80 w-full" /></div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export function AssessmentEditor({
  assessment,
  assets = [],
  controlImplementations = {},
  controls = [],
  risks: initialRisks = [],
  riskTypes = [],
  state = 'populated',
  systems = [],
  searchOwners = async () => ({ ok: false, formError: 'Owner search is unavailable. Please try again later.' }),
}: AssessmentEditorProps) {
  const [currentAssessment, setCurrentAssessment] = useState(assessment);
  const [risks, setRisks] = useState<readonly AnalystRisk[]>(initialRisks);
  const [implementations, setImplementations] = useState<Readonly<Record<string, readonly ControlImplementation[]>>>(controlImplementations);
  const [addingRisk, setAddingRisk] = useState(false);
  const [addingControlTo, setAddingControlTo] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  if (state !== 'populated' || !currentAssessment) {
    return <SafeAssessmentState state={state === 'populated' ? 'empty' : state} />;
  }

  const mutable = canMutateAssessment(currentAssessment);
  const readiness = currentAssessment.releaseReadiness;
  const canOfferRelease = mutable && currentAssessment.assessmentStatus === 'in-review';
  const assessmentId = currentAssessment.documentId;
  const status = assessmentStatusPresentation[currentAssessment.assessmentStatus];
  const StatusIcon = status.icon;

  async function refreshAssessment(): Promise<void> {
    const result = await refreshAnalystAssessmentAction({ assessmentId });
    if (!result.ok) return;
    setCurrentAssessment(result.data);
    setRisks(result.data.risks);
  }

  async function release() {
    setReleaseError(null);
    const result = await releaseAssessmentAction({ assessmentId: currentAssessment?.documentId });
    if (!result?.ok) {
      setReleaseError(result?.formError ?? 'The assessment service is unavailable. Please try again later.');
      throw new Error('Release failed');
    }
    setCurrentAssessment((current) => current ? { ...current, ...result.data } : current);
  }

  const options = { assets, controls, riskTypes, systems, users: currentAssessment.ownerLabels };

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        action={<Badge aria-live="polite" className="border-border bg-surface-muted text-foreground-secondary" variant="outline"><StatusIcon aria-hidden="true" />{status.label}</Badge>}
        description={currentAssessment.assessmentNumber}
        title="Risk assessment review"
      />
      <AssessmentRequestLink actor={currentAssessment.actor} request={currentAssessment.assessmentRequest} />
      <AssessmentLifecycleStepper status={currentAssessment.assessmentStatus} />
      {!mutable ? (
        <Alert aria-live="polite">
          {currentAssessment.assessmentStatus === 'approved' ? <CheckCircle2Icon aria-hidden="true" /> : <LockKeyholeIcon aria-hidden="true" />}
          <AlertTitle>{currentAssessment.assessmentStatus === 'approved' ? 'Assessment released' : 'Assessment is read-only'}</AlertTitle>
          <AlertDescription>{currentAssessment.assessmentStatus === 'approved' ? 'Release is complete. Analyst mutation controls have been removed.' : 'A release fact exists or this workflow state cannot be changed.'}</AlertDescription>
        </Alert>
      ) : null}
      {hasSupersededReview(currentAssessment)
        ? <SupersededReviewNotice reviewerName={currentAssessment.reviewedBy?.displayName} />
        : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <AssessmentMetadata assessment={currentAssessment} mutable={mutable} onUpdated={refreshAssessment} />
        <Card>
          <CardHeader>
            <h2 className="text-heading-sm">Release readiness</h2>
            <CardDescription>Strapi rechecks every item when release is requested.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div aria-atomic="true" aria-live="polite">
              <p className="flex items-center gap-2 text-sm text-foreground">
                {readiness.ready ? <CheckCircle2Icon aria-hidden="true" className="size-4 shrink-0 text-success" /> : <AlertCircleIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />}
                {readiness.ready ? 'All release requirements are met' : `${readiness.requirements.filter((requirement) => requirement.state === 'met').length} of ${readiness.requirements.length} release requirements met`}
              </p>
              <ul aria-label="Release requirements" className="grid gap-2 text-sm">
                {readiness.requirements.map((requirement) => {
                  const item = releaseReadinessPresentation(requirement);
                  const Icon = requirement.state === 'met' ? CheckCircle2Icon : AlertCircleIcon;
                  const key = requirement.scope === 'risk'
                    ? `${requirement.scope}-${requirement.riskNumber}-${requirement.key}`
                    : `${requirement.scope}-${requirement.key}`;
                  return <li className="grid min-w-0 gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={key}>
                    <a className="flex min-w-0 items-start gap-2 text-text-link underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" href={item.href}>
                      <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${requirement.state === 'met' ? 'text-success' : 'text-warning'}`} />
                      <span className="min-w-0 break-words">{item.label}</span>
                    </a>
                    <span className="flex items-center gap-1 text-xs font-medium text-foreground"><Icon aria-hidden="true" className={`size-4 shrink-0 ${requirement.state === 'met' ? 'text-success' : 'text-warning'}`} />{requirement.state === 'met' ? 'Met' : 'Outstanding'}</span>
                  </li>;
                })}
              </ul>
            </div>
            {canOfferRelease ? (
              <ConfirmDialog
                confirmLabel="Confirm release"
                confirmVariant="destructive"
                description="Release is irreversible. Requestors will receive the assessment as read-only, and all analyst mutation controls will be removed."
                errorMessage={releaseError}
                onConfirm={release}
                pendingLabel="Releasing assessment…"
                title="Release this risk assessment?"
                trigger={<Button disabled={!readiness.ready} type="button" variant="destructive">Release assessment</Button>}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <DetailSection description="Contextual Risks identified for this assessment. Risk Types remain reusable non-editable references." headingId="identified-risks" title="Identified Risks">
        <div className="grid min-w-0 gap-5">
          {risks.length === 0 ? <p className="text-sm text-muted-foreground">No Risks have been identified.</p> : risks.map((risk) => (
            <Card className="min-w-0" id={`risk-${encodeURIComponent(risk.documentId)}`} key={risk.documentId}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{risk.riskNumber}</CardTitle>{risk.residualRating ? <RiskRatingBadge rating={risk.residualRating} /> : null}</div>
                <CardDescription>{risk.riskStatement || 'Risk statement not provided'}</CardDescription>
              </CardHeader>
              <CardContent className="grid min-w-0 gap-6">
                {mutable ? <RiskEditor assessmentId={currentAssessment.documentId} mode="edit" onUpdated={() => { void refreshAssessment(); }} options={options} risk={risk} searchOwners={searchOwners} /> : <RiskReadOnly risk={risk} />}
                <section aria-label={`Mitigation controls for ${risk.riskNumber}`} className="grid gap-4">
                  <h3 className="text-heading-sm">Mitigation controls</h3>
                  {(implementations[risk.documentId] ?? []).map((implementation) => mutable ? (
                    <ControlImplementationEditor
                      assessmentId={currentAssessment.documentId}
                      implementation={implementation}
                      key={implementation.documentId}
                      mode="edit"
                      onUpdated={() => { void refreshAssessment(); }}
                      onRemoved={(implementationId) => { setImplementations((current) => ({ ...current, [risk.documentId]: (current[risk.documentId] ?? []).filter((item) => item.documentId !== implementationId) })); void refreshAssessment(); }}
                      options={options}
                      riskId={risk.documentId}
                    />
                  ) : <ControlReadOnly implementation={implementation} key={implementation.documentId} controls={controls} />)}
                  {mutable && addingControlTo === risk.documentId ? <ControlImplementationEditor assessmentId={currentAssessment.documentId} mode="create" onCreated={(created) => { setImplementations((current) => ({ ...current, [risk.documentId]: [...(current[risk.documentId] ?? []), created] })); setAddingControlTo(null); void refreshAssessment(); }} options={options} riskId={risk.documentId} /> : null}
                  {mutable && addingControlTo !== risk.documentId ? <Button className="justify-self-start" onClick={() => setAddingControlTo(risk.documentId)} type="button" variant="outline"><PlusIcon aria-hidden="true" />Add mitigation control</Button> : null}
                </section>
              </CardContent>
            </Card>
          ))}
          {mutable && addingRisk ? <Card><CardHeader><CardTitle>Add Risk</CardTitle></CardHeader><CardContent><RiskEditor assessmentId={currentAssessment.documentId} mode="create" onCreated={() => { setAddingRisk(false); void refreshAssessment(); }} options={options} searchOwners={searchOwners} /></CardContent></Card> : null}
          {mutable && !addingRisk ? <Button className="justify-self-start" onClick={() => setAddingRisk(true)} type="button"><PlusIcon aria-hidden="true" />Add Risk</Button> : null}
        </div>
      </DetailSection>
    </div>
  );
}

function AssessmentMetadata({ assessment, mutable, onUpdated }: { assessment: AnalystAssessmentDetail; mutable: boolean; onUpdated: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<AssessmentUpdateInput>({ defaultValues: {
    summary: assessment.summary ?? '',
    overallRating: assessment.overallRating ?? undefined,
    overallControlEffectiveness: assessment.overallControlEffectiveness ?? undefined,
    recommendationsSummary: assessment.recommendationsSummary ?? '',
    overallRiskRationale: assessment.overallRiskRationale ?? '',
    nextReviewDate: assessment.nextReviewDate,
  } });

  async function submit(values: AssessmentUpdateInput) {
    setFormError(null);
    const normalized: AssessmentUpdateInput = {
      ...values,
      overallRating: values.overallRating || undefined,
      overallControlEffectiveness: values.overallControlEffectiveness || undefined,
      nextReviewDate: values.nextReviewDate || null,
    };
    const result = await saveAssessmentAction({ assessmentId: assessment.documentId, values: normalized });
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages?.[0];
        if (message && field in form.getValues()) form.setError(field as keyof AssessmentUpdateInput, { message });
      }
      setFormError(result.formError);
      return;
    }
    onUpdated();
  }

  if (!mutable) {
    return <DetailSection description="Assessment context and analyst conclusion." headingId="assessment-details" title="Assessment details"><dl className="grid gap-4 sm:grid-cols-2"><DetailValue label="Summary" value={assessment.summary} /><DetailValue label="Overall rating" value={assessment.overallRating} /><DetailValue label="Overall control effectiveness" value={assessment.overallControlEffectiveness} /><DetailValue label="Overall risk rationale" value={assessment.overallRiskRationale} /><DetailValue label="Recommendations" value={assessment.recommendationsSummary} /><DetailValue label="Next review date" value={assessment.nextReviewDate} /></dl></DetailSection>;
  }

  return (
    <DetailSection description="Edit the analyst-owned assessment conclusion. Workflow and release facts are server-owned." headingId="assessment-details" title="Assessment details">
      <form className="grid gap-5" noValidate onSubmit={form.handleSubmit(submit)}>
        {formError ? <Alert variant="destructive"><AlertTitle>Assessment not saved</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
        <MetadataFieldErrorInput error={form.formState.errors.summary?.message} label="Summary"><Textarea aria-describedby={form.formState.errors.summary ? 'summary-error' : undefined} aria-invalid={Boolean(form.formState.errors.summary)} {...form.register('summary')} /></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.overallRating?.message} label="Overall rating"><select aria-describedby={form.formState.errors.overallRating ? 'overallRating-error' : undefined} aria-invalid={Boolean(form.formState.errors.overallRating)} className="h-9 rounded-md border border-input bg-surface px-3 text-sm" {...form.register('overallRating')}><option value="">Not specified</option>{['Low', 'Moderate', 'High', 'Critical'].map((value) => <option key={value}>{value}</option>)}</select></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.overallControlEffectiveness?.message} label="Overall control effectiveness"><select aria-describedby={form.formState.errors.overallControlEffectiveness ? 'overallControlEffectiveness-error' : undefined} aria-invalid={Boolean(form.formState.errors.overallControlEffectiveness)} className="h-9 rounded-md border border-input bg-surface px-3 text-sm" {...form.register('overallControlEffectiveness')}><option value="">Not specified</option>{['Effective', 'Partially Effective', 'Ineffective', 'Not Assessed'].map((value) => <option key={value}>{value}</option>)}</select></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.overallRiskRationale?.message} label="Overall risk rationale"><Textarea aria-describedby={form.formState.errors.overallRiskRationale ? 'overallRiskRationale-error' : undefined} aria-invalid={Boolean(form.formState.errors.overallRiskRationale)} {...form.register('overallRiskRationale')} /></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.recommendationsSummary?.message} label="Recommendations"><Textarea aria-describedby={form.formState.errors.recommendationsSummary ? 'recommendationsSummary-error' : undefined} aria-invalid={Boolean(form.formState.errors.recommendationsSummary)} {...form.register('recommendationsSummary')} /></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.nextReviewDate?.message} label="Next review date"><Input aria-describedby={form.formState.errors.nextReviewDate ? 'nextReviewDate-error' : undefined} aria-invalid={Boolean(form.formState.errors.nextReviewDate)} type="date" {...form.register('nextReviewDate')} /></MetadataFieldErrorInput>
        <div><Button disabled={form.formState.isSubmitting} type="submit">Save assessment</Button></div>
      </form>
    </DetailSection>
  );
}

function MetadataFieldErrorInput({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  const id = `${label === 'Summary' ? 'summary' : label === 'Overall rating' ? 'overallRating' : label === 'Overall control effectiveness' ? 'overallControlEffectiveness' : label === 'Overall risk rationale' ? 'overallRiskRationale' : label === 'Recommendations' ? 'recommendationsSummary' : 'nextReviewDate'}-error`;
  return <label className="grid gap-2"><span className="text-sm font-medium">{label}</span>{children}{error ? <span className="flex items-start gap-1 text-sm text-destructive" id={id}><AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</span> : null}</label>;
}

function DetailValue({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value || 'Not provided'}</dd></div>;
}

function RiskReadOnly({ risk }: { risk: AnalystRisk }) {
  const fields = useMemo(() => [
    ['Risk statement', risk.riskStatement],
    ['Inherent likelihood', risk.inherentLikelihood],
    ['Highest inherent consequence', risk.highestInherentConsequence],
    ['Residual likelihood', risk.residualLikelihood],
    ['Highest residual consequence', risk.highestResidualConsequence],
    ['Treatment plan', risk.treatmentPlan],
  ] as const, [risk]);
  return <dl className="grid gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <DetailValue key={label} label={label} value={value} />)}</dl>;
}

function ControlReadOnly({ controls, implementation }: { controls: readonly Control[]; implementation: ControlImplementation }) {
  const control = controls.find((item) => item.documentId === implementation.control);
  return <dl className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2"><DetailValue label="Reusable control" value={control ? `${control.controlNumber} — ${control.name}` : implementation.control} /><DetailValue label="Control owner" value={implementation.controlOwner?.displayName} /><DetailValue label="Control status" value={implementation.controlStatus} /><DetailValue label="Effectiveness rating" value={implementation.effectivenessRating} /><DetailValue label="Evidence" value={implementation.evidence} /><DetailValue label="Review date" value={implementation.reviewDate} /></dl>;
}
