'use client';

import { AlertCircleIcon, CheckCircle2Icon, ChevronDownIcon, ChevronUpIcon, LockKeyholeIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { DetailSection } from '@/components/csrm/detail-section';
import { PageHeader } from '@/components/csrm/page-header';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { SaveStatus } from '@/components/csrm/save-status';
import { StatusBadge } from '@/components/csrm/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { RequestRelationSummary } from '@/features/requests/request-domain';
import { refreshAnalystAssessmentAction, releaseAssessmentAction, saveAssessmentAction } from './assessment-actions';
import {
  type ActiveUser,
  type AnalystAssessmentDetail,
  type AssessmentDetail,
  type AssessmentRiskListItem,
  type AssessmentUpdateInput,
  type ControlImplementation,
  type AnalystRisk,
  type RiskType,
  type RiskUpdateInput,
} from './assessment-schema';
import type { RelationPickerItem, RelationPickerSearchInput, RelationPickerSearchResult } from '@/components/csrm/relation-picker';
import { ControlImplementationEditor, type ControlImplementationEditorOptions } from './control-implementation-editor';
import { RiskEditor, type EditableRisk } from './risk-editor';
import type { OwnerSearchInput, OwnerSearchResult } from './owner-combobox';
import { applicableControlGroup, assessmentDetailsFormValues, assessmentRiskListItemFromAnalystRisk, assessmentSaveWrites, canMutateAssessment, normalizeAssessmentDetails } from './assessment-domain';
import { missingCaption, summarizeReleaseReadiness, type ReleaseReadinessSummary } from './release-readiness-summary';
import { ReleasedRiskDetails } from './released-risk-details';
import { AssessmentLifecycleStepper } from './assessment-lifecycle-stepper';
import { AssessmentRequestLink } from './assessment-request-link';
import type { AnalystRefusal } from './assessment-detail';
import { useRecordSaveStatus } from './use-record-save-status';

/** The add control focus returns to after a create (UI-SPEC §13.4, UI-D18). */
type PendingFocus = { kind: 'add-risk' } | { kind: 'add-control'; riskId: string };

export type AssessmentEditorState = 'populated' | 'empty' | 'error' | 'permission';

export type AssessmentEditorProps = {
  assessment?: AnalystAssessmentDetail;
  controlImplementations?: Readonly<Record<string, readonly ControlImplementation[]>>;
  /** Who a permission state is for: `role` when the route gate refused the viewer before any read (UI-SPEC §11.1). */
  refusal?: AnalystRefusal;
  risks?: readonly AnalystRisk[];
  /** The assessment's served risk list items, read by the page when the assessment can no longer change (D-34). */
  riskListItems?: readonly AssessmentRiskListItem[];
  riskTypes?: readonly RiskType[];
  state?: AssessmentEditorState;
  /** The originating request's selected systems and assets, offered first in their pickers (D-30). */
  requestSystems?: readonly RequestRelationSummary[];
  requestAssets?: readonly RequestRelationSummary[];
  /** Served names of the systems and assets the Risks hold, keyed by id, from the Risk list read (D-30). */
  relationLabels?: Readonly<Record<string, string>>;
  searchOwners?: (input: OwnerSearchInput) => Promise<OwnerSearchResult>;
  /** Searches the control library for the Control picker (D-29); the page passes the Server Action. */
  searchControls?: (input: RelationPickerSearchInput) => Promise<RelationPickerSearchResult>;
  /** Search the whole system and asset inventories for their pickers (D-28); the page passes the Server Actions. */
  searchSystems?: (input: RelationPickerSearchInput) => Promise<RelationPickerSearchResult>;
  searchAssets?: (input: RelationPickerSearchInput) => Promise<RelationPickerSearchResult>;
};

/** A picker with no search from the page says the service is unavailable; it never pretends nothing matches. */
const unavailableSearch = async (): Promise<RelationPickerSearchResult> => ({ ok: false, formError: 'The selection service is unavailable. Please try again later.' });
const noRelationLabels: Readonly<Record<string, string>> = {};

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

function SafeAssessmentState({ refusal = 'record', state }: { refusal?: AnalystRefusal; state: Exclude<AssessmentEditorState, 'populated'> }) {
  const permission = state === 'permission';
  const empty = state === 'empty';
  const roleRefusal = permission && refusal === 'role';
  const permissionDescription = roleRefusal
    ? 'Reviewing assessments is for Security Analysts. Assessments released to you are in My Risk Assessments.'
    : 'You can’t review this assessment with your current access. Choose another from the risk assessments.';
  return (
    <div className="grid gap-5">
      <PageHeader description="Review an authorised risk assessment." title="Risk assessment review" />
      <Alert role={permission || state === 'error' ? 'alert' : undefined} variant={permission || state === 'error' ? 'destructive' : 'default'}>
        <AlertCircleIcon aria-hidden="true" />
        <AlertTitle>{permission ? 'You don’t have permission to review this assessment' : empty ? 'No assessment details are available' : 'We couldn’t load this assessment'}</AlertTitle>
        <AlertDescription>{permission ? permissionDescription : empty ? 'Return to the assessment queue and choose another assessment.' : 'Try again. If the problem continues, contact your administrator.'}</AlertDescription>
      </Alert>
      <div>
        {roleRefusal
          ? <Link className={buttonVariants({ variant: 'outline' })} href="/app/assessments">Go to My Risk Assessments</Link>
          : <Link className={buttonVariants({ variant: 'outline' })} href="/app/review/assessments">Back to risk assessments</Link>}
      </div>
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
  controlImplementations = {},
  refusal,
  risks: initialRisks = [],
  riskListItems = [],
  riskTypes = [],
  state = 'populated',
  requestSystems = [],
  requestAssets = [],
  relationLabels = noRelationLabels,
  searchOwners = async () => ({ ok: false, formError: 'Owner search is unavailable. Please try again later.' }),
  searchControls = unavailableSearch,
  searchSystems = unavailableSearch,
  searchAssets = unavailableSearch,
}: AssessmentEditorProps) {
  const [currentAssessment, setCurrentAssessment] = useState(assessment);
  const [risks, setRisks] = useState<readonly AnalystRisk[]>(initialRisks);
  const [implementations, setImplementations] = useState<Readonly<Record<string, readonly ControlImplementation[]>>>(controlImplementations);
  const [addingRisk, setAddingRisk] = useState(false);
  const [addingControlTo, setAddingControlTo] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  // Names of records chosen by search join the served labels, so an editor remounted after a save keeps them.
  const [knownRelationLabels, setKnownRelationLabels] = useState<Readonly<Record<string, string>>>(relationLabels);
  const rememberRelation = (item: RelationPickerItem) => setKnownRelationLabels((current) => (
    current[item.documentId] === item.name ? current : { ...current, [item.documentId]: item.name }
  ));
  // When each Risk or mitigation control was just added, by id, so its new form confirms the create (UI-SPEC §13.4).
  const [addedAt, setAddedAt] = useState<Readonly<Record<string, string>>>({});
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null);
  const addRiskButton = useRef<HTMLButtonElement>(null);
  const addControlButtons = useRef(new Map<string, HTMLButtonElement>());

  // After a create, focus returns to the add control that opened the form, once it is back on the page.
  useEffect(() => {
    if (!pendingFocus) return;
    const target = pendingFocus.kind === 'add-risk' ? addRiskButton.current : addControlButtons.current.get(pendingFocus.riskId);
    if (!target) return;
    target.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  const markAdded = (documentId: string) => setAddedAt((current) => ({ ...current, [documentId]: new Date().toISOString() }));

  if (state !== 'populated' || !currentAssessment) {
    return <SafeAssessmentState refusal={refusal} state={state === 'populated' ? 'empty' : state} />;
  }

  const mutable = canMutateAssessment(currentAssessment);
  const readiness = currentAssessment.releaseReadiness;
  const canOfferRelease = mutable && currentAssessment.assessmentStatus === 'in-review';
  const assessmentId = currentAssessment.documentId;

  /*
   * After every accepted change the server's answer is applied first, then the assessment is read again for the
   * release facts that change derives (CR-201). A failed read keeps what the answers already applied, so no form
   * compares with page-load values and no new Risk is hidden.
   */
  async function refreshAssessment(): Promise<void> {
    const result = await refreshAnalystAssessmentAction({ assessmentId });
    if (!result.ok) return;
    setCurrentAssessment(result.data);
    setRisks(result.data.risks);
  }

  function applySavedAssessment(saved: AssessmentDetail) {
    setCurrentAssessment((current) => (current ? { ...current, ...saved } : current));
    void refreshAssessment();
  }

  function applySavedRisk(saved: AnalystRisk) {
    setRisks((current) => current.map((item) => (item.documentId === saved.documentId ? saved : item)));
    void refreshAssessment();
  }

  function applyCreatedRisk(created: AnalystRisk) {
    setRisks((current) => (current.some((item) => item.documentId === created.documentId) ? current : [...current, created]));
    markAdded(created.documentId);
    setAddingRisk(false);
    setPendingFocus({ kind: 'add-risk' });
    void refreshAssessment();
  }

  function applySavedImplementation(riskId: string, saved: ControlImplementation) {
    setImplementations((current) => ({
      ...current,
      [riskId]: (current[riskId] ?? []).map((item) => (item.documentId === saved.documentId ? saved : item)),
    }));
    void refreshAssessment();
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

  const options = {
    riskTypes,
    users: currentAssessment.ownerLabels,
    requestSystems,
    requestAssets,
    relationLabels: knownRelationLabels,
    searchSystems,
    searchAssets,
  };
  const labelledRecords = Object.entries(knownRelationLabels).map(([documentId, name]) => ({ documentId, name }));
  // Each Risk's Control picker offers its saved Risk Type's applicable controls first (D-31).
  // The control owner searches every active user (D-28), never only the names already on the Risk.
  const controlOptionsFor = (risk: AnalystRisk): ControlImplementationEditorOptions => ({
    suggestedControls: applicableControlGroup(riskTypes, risk.riskType),
    searchControls,
    searchOwners,
  });

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        status={<StatusBadge family="assessment" live value={currentAssessment.assessmentStatus} />}
        description={currentAssessment.assessmentNumber}
        title="Risk assessment review"
      />
      <AssessmentRequestLink actor={currentAssessment.actor} request={currentAssessment.assessmentRequest} />
      <AssessmentLifecycleStepper status={currentAssessment.assessmentStatus} />
      {!mutable ? (
        <Alert aria-live="polite">
          {currentAssessment.assessmentStatus === 'approved' ? <CheckCircle2Icon aria-hidden="true" /> : <LockKeyholeIcon aria-hidden="true" />}
          <AlertTitle>{currentAssessment.assessmentStatus === 'approved' ? 'Assessment released' : 'Assessment is read-only'}</AlertTitle>
          <AlertDescription>{currentAssessment.assessmentStatus === 'approved'
            ? 'The Requestor can now read this assessment. It can no longer be changed.'
            : currentAssessment.assessmentStatus === 'closed'
              ? 'This assessment is closed, so it can no longer be changed.'
              : 'This assessment can no longer be changed in its current state.'}</AlertDescription>
        </Alert>
      ) : null}
      {hasSupersededReview(currentAssessment)
        ? <SupersededReviewNotice reviewerName={currentAssessment.reviewedBy?.displayName} />
        : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <AssessmentMetadata assessment={currentAssessment} mutable={mutable} onUpdated={applySavedAssessment} />
        <Card>
          <CardHeader>
            <h2 className="text-heading-sm">Release readiness</h2>
            <CardDescription>Every requirement must be met before release. We check them all again when you release.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ReleaseReadinessRequirements summary={summarizeReleaseReadiness(readiness)} />
            {canOfferRelease ? (
              <ConfirmDialog
                confirmLabel="Confirm release"
                confirmVariant="destructive"
                description="Release can’t be undone. The Requestor will receive this assessment read-only, and no one can change it afterwards."
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

      <DetailSection description="Risks identified in this assessment, with their ratings, treatment and mitigation controls." headingFocusable headingId="identified-risks" title="Identified Risks">
        <div className="grid min-w-0 gap-5">
          {risks.length === 0 ? <p className="text-sm text-muted-foreground">No Risks have been identified.</p> : risks.map((risk) => (
            <Card className="min-w-0" id={`risk-${encodeURIComponent(risk.documentId)}`} key={risk.documentId} tabIndex={-1}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{risk.riskNumber}</CardTitle>{risk.residualRating ? <RiskRatingBadge rating={risk.residualRating} /> : null}</div>
                <CardDescription>{risk.riskStatement || 'Risk statement not provided'}</CardDescription>
              </CardHeader>
              <CardContent className="grid min-w-0 gap-6">
                {mutable ? (
                  <>
                    <RiskEditor addedAt={addedAt[risk.documentId]} assessmentId={currentAssessment.documentId} mode="edit" onRelationChosen={rememberRelation} onUpdated={applySavedRisk} options={options} risk={risk} searchOwners={searchOwners} />
                    <section aria-label={`Mitigation controls for ${risk.riskNumber}`} className="grid gap-4">
                      <h3 className="text-heading-sm">Mitigation controls</h3>
                      {(implementations[risk.documentId] ?? []).map((implementation) => (
                        <ControlImplementationEditor
                          addedAt={addedAt[implementation.documentId]}
                          assessmentId={currentAssessment.documentId}
                          implementation={implementation}
                          key={implementation.documentId}
                          mode="edit"
                          onUpdated={(saved) => applySavedImplementation(risk.documentId, saved)}
                          onRemoved={(implementationId) => { setImplementations((current) => ({ ...current, [risk.documentId]: (current[risk.documentId] ?? []).filter((item) => item.documentId !== implementationId) })); void refreshAssessment(); }}
                          options={controlOptionsFor(risk)}
                          riskId={risk.documentId}
                        />
                      ))}
                      {addingControlTo === risk.documentId ? <ControlImplementationEditor assessmentId={currentAssessment.documentId} focusControlOnOpen mode="create" onCreated={(created) => { setImplementations((current) => ({ ...current, [risk.documentId]: [...(current[risk.documentId] ?? []), created] })); markAdded(created.documentId); setAddingControlTo(null); setPendingFocus({ kind: 'add-control', riskId: risk.documentId }); void refreshAssessment(); }} options={controlOptionsFor(risk)} riskId={risk.documentId} /> : null}
                      {addingControlTo !== risk.documentId ? (
                        <Button
                          className="justify-self-start"
                          onClick={() => setAddingControlTo(risk.documentId)}
                          ref={(element) => {
                            if (element) addControlButtons.current.set(risk.documentId, element);
                            else addControlButtons.current.delete(risk.documentId);
                          }}
                          type="button"
                          variant="outline"
                        >
                          <PlusIcon aria-hidden="true" />Add mitigation control
                        </Button>
                      ) : null}
                    </section>
                  </>
                ) : (
                  // The released Risk reads as it does for the Requestor (D-34, UI-SPEC §15.2): one shared component,
                  // its groups at h3 beside this page's h3 headings, each control named by its served summary.
                  <ReleasedRiskDetails
                    groupHeadingLevel={3}
                    implementations={implementations[risk.documentId] ?? []}
                    risk={riskListItems.find((item) => item.documentId === risk.documentId)
                      ?? assessmentRiskListItemFromAnalystRisk(risk, {
                        users: currentAssessment.ownerLabels,
                        systems: [...requestSystems, ...labelledRecords],
                        assets: [...requestAssets, ...labelledRecords],
                      })}
                  />
                )}
              </CardContent>
            </Card>
          ))}
          {mutable && addingRisk ? <Card><CardHeader><CardTitle>Add Risk</CardTitle></CardHeader><CardContent><RiskEditor assessmentId={currentAssessment.documentId} mode="create" onCreated={applyCreatedRisk} onRelationChosen={rememberRelation} options={options} searchOwners={searchOwners} /></CardContent></Card> : null}
          {mutable && !addingRisk ? <Button className="justify-self-start" onClick={() => setAddingRisk(true)} ref={addRiskButton} type="button"><PlusIcon aria-hidden="true" />Add Risk</Button> : null}
        </div>
      </DetailSection>
    </div>
  );
}

const readinessLinkClass = 'min-w-0 break-words text-text-link underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const readinessRowClass = 'grid min-w-0 gap-1 rounded-md border border-border p-3';

/** The state a readiness row shows beside its label: words and an icon, never colour alone. */
function ReadinessState({ children, met }: { children: ReactNode; met: boolean }) {
  const Icon = met ? CheckCircle2Icon : AlertCircleIcon;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-foreground">
      <Icon aria-hidden="true" className={`size-4 shrink-0 ${met ? 'text-success' : 'text-warning'}`} />{children}
    </span>
  );
}

/**
 * The Release readiness summary (D-35, UI-SPEC §14.1): the outstanding assessment items, then one row per Risk
 * with what is missing, and the met items only when the analyst asks. Display only; the release control and the
 * server's own check on release are unchanged. Control names avoid save, add, edit, remove and release (UI-D19).
 */
function ReleaseReadinessRequirements({ summary }: { summary: ReleaseReadinessSummary }) {
  const [showMet, setShowMet] = useState(false);
  const baseId = useId();
  const metListId = `${baseId}-met`;
  const hasOutstanding = summary.outstandingAssessment.length > 0 || summary.outstandingRisks.length > 0;
  const hasMet = summary.met > 0;

  return (
    <>
      <p aria-atomic="true" aria-live="polite" className="flex items-center gap-2 text-sm text-foreground">
        {summary.ready ? <CheckCircle2Icon aria-hidden="true" className="size-4 shrink-0 text-success" /> : <AlertCircleIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />}
        {summary.ready ? 'All release requirements are met' : `${summary.met} of ${summary.total} release requirements met`}
      </p>
      {hasOutstanding ? (
        <ul aria-label="Release requirements" className="grid gap-2 text-sm">
          {summary.outstandingAssessment.map((item) => (
            <li className={`${readinessRowClass} sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3`} key={`assessment-${item.key}`}>
              <a className={readinessLinkClass} href={item.href}>{item.label}</a>
              <ReadinessState met={false}>Outstanding</ReadinessState>
            </li>
          ))}
          {summary.outstandingRisks.map((row, index) => {
            const captionId = `${baseId}-missing-${index}`;
            return (
              <li className={readinessRowClass} key={`risk-${row.href}`}>
                {/*
                  * The name reads `{risk number}: {n} outstanding`; what is missing is its description. The space
                  * between the two parts keeps the visible words the words of the name (Label in Name, WCAG 2.5.3).
                  */}
                <a aria-describedby={captionId} aria-label={`${row.riskNumber}: ${row.outstanding} outstanding`} className={`${readinessLinkClass} flex flex-wrap items-center gap-x-3 gap-y-1`} href={row.href}>
                  <span className="min-w-0 break-words">{row.riskNumber}</span>{' '}
                  <ReadinessState met={false}>{row.outstanding} outstanding</ReadinessState>
                </a>
                <p className="break-words text-xs text-muted-foreground" id={captionId}>{missingCaption(row.missing)}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
      {hasMet ? (
        <>
          <Button
            aria-controls={metListId}
            aria-expanded={showMet}
            className="justify-self-start max-md:min-h-11"
            data-print="hidden"
            onClick={() => setShowMet((current) => !current)}
            size="sm"
            type="button"
            variant="outline"
          >
            {showMet
              ? <><ChevronUpIcon aria-hidden="true" />Hide met requirements</>
              : <><ChevronDownIcon aria-hidden="true" />Show met requirements ({summary.met})</>}
          </Button>
          <ul aria-label="Met release requirements" className="grid gap-2 text-sm" hidden={!showMet} id={metListId}>
            {summary.metAssessment.map((item) => (
              <li className={`${readinessRowClass} sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3`} key={`assessment-${item.key}`}>
                <a className={readinessLinkClass} href={item.href}>{item.label}</a>
                <ReadinessState met>Met</ReadinessState>
              </li>
            ))}
            {summary.metRisks.map((row) => (
              <li className={readinessRowClass} key={`risk-${row.href}`}>
                <a aria-label={`${row.riskNumber}: ${row.met} met`} className={`${readinessLinkClass} flex flex-wrap items-center gap-x-3 gap-y-1`} href={row.href}>
                  <span className="min-w-0 break-words">{row.riskNumber}</span>
                  <ReadinessState met>{row.met} met</ReadinessState>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function AssessmentMetadata({ assessment, mutable, onUpdated }: { assessment: AnalystAssessmentDetail; mutable: boolean; onUpdated: (saved: AssessmentDetail) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<AssessmentUpdateInput>({ defaultValues: assessmentDetailsFormValues(assessment) });
  const confirmation = useRecordSaveStatus(form.watch);

  async function submit(values: AssessmentUpdateInput) {
    setFormError(null);
    confirmation.clear();
    // Unchanged details send nothing, as on the Risk and mitigation control forms (UI-SPEC §13.4).
    if (!assessmentSaveWrites(assessment.assessmentStatus, values, assessment)) {
      confirmation.note('No changes to save.');
      return;
    }
    const normalized = normalizeAssessmentDetails(values);
    const result = await saveAssessmentAction({ assessmentId: assessment.documentId, values: normalized });
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages?.[0];
        if (message && field in form.getValues()) form.setError(field as keyof AssessmentUpdateInput, { message });
      }
      setFormError(result.formError);
      return;
    }
    // Confirmed only after an ok result, so a save that did not persist never reads as saved (T-10-54).
    confirmation.saved();
    onUpdated(result.data);
  }

  if (!mutable) {
    return <DetailSection description="Assessment context and analyst conclusion." headingFocusable headingId="assessment-details" title="Assessment details"><dl className="grid gap-4 sm:grid-cols-2"><DetailValue label="Summary" value={assessment.summary} /><DetailValue label="Overall rating" value={assessment.overallRating} /><DetailValue label="Overall control effectiveness" value={assessment.overallControlEffectiveness} /><DetailValue label="Overall risk rationale" value={assessment.overallRiskRationale} /><DetailValue label="Recommendations" value={assessment.recommendationsSummary} /><DetailValue label="Next review date" value={assessment.nextReviewDate} /></dl></DetailSection>;
  }

  return (
    <DetailSection description="Record the assessment’s summary, overall rating and recommendations." headingFocusable headingId="assessment-details" title="Assessment details">
      <form className="grid gap-5" noValidate onSubmit={form.handleSubmit(submit)}>
        {formError ? <Alert variant="destructive"><AlertTitle>Assessment not saved</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
        <MetadataFieldErrorInput error={form.formState.errors.summary?.message} label="Summary"><Textarea aria-describedby={form.formState.errors.summary ? 'summary-error' : undefined} aria-invalid={Boolean(form.formState.errors.summary)} {...form.register('summary')} /></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.overallRating?.message} label="Overall rating"><select aria-describedby={form.formState.errors.overallRating ? 'overallRating-error' : undefined} aria-invalid={Boolean(form.formState.errors.overallRating)} className="h-9 rounded-md border border-input bg-surface px-3 text-sm" {...form.register('overallRating')}><option value="">Not specified</option>{['Low', 'Moderate', 'High', 'Critical'].map((value) => <option key={value}>{value}</option>)}</select></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.overallControlEffectiveness?.message} label="Overall control effectiveness"><select aria-describedby={form.formState.errors.overallControlEffectiveness ? 'overallControlEffectiveness-error' : undefined} aria-invalid={Boolean(form.formState.errors.overallControlEffectiveness)} className="h-9 rounded-md border border-input bg-surface px-3 text-sm" {...form.register('overallControlEffectiveness')}><option value="">Not specified</option>{['Effective', 'Partially Effective', 'Ineffective', 'Not Assessed'].map((value) => <option key={value}>{value}</option>)}</select></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.overallRiskRationale?.message} label="Overall risk rationale"><Textarea aria-describedby={form.formState.errors.overallRiskRationale ? 'overallRiskRationale-error' : undefined} aria-invalid={Boolean(form.formState.errors.overallRiskRationale)} {...form.register('overallRiskRationale')} /></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.recommendationsSummary?.message} label="Recommendations"><Textarea aria-describedby={form.formState.errors.recommendationsSummary ? 'recommendationsSummary-error' : undefined} aria-invalid={Boolean(form.formState.errors.recommendationsSummary)} {...form.register('recommendationsSummary')} /></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.nextReviewDate?.message} label="Next review date"><Input aria-describedby={form.formState.errors.nextReviewDate ? 'nextReviewDate-error' : undefined} aria-invalid={Boolean(form.formState.errors.nextReviewDate)} type="date" {...form.register('nextReviewDate')} /></MetadataFieldErrorInput>
        {/* X-1: the confirmation sits beside Save from 640px and below it on a phone. */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center" data-slot="form-actions">
          <Button disabled={form.formState.isSubmitting} type="submit">Save assessment</Button>
          <SaveStatus savedLabel={(time) => <>Assessment details saved at {time}</>} status={confirmation.status} />
        </div>
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

