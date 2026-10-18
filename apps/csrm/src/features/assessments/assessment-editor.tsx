'use client';

import { AlertCircleIcon, CheckCircle2Icon, ChevronDownIcon, ChevronUpIcon, History, InfoIcon, LockKeyholeIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { DetailSection } from '@/components/csrm/detail-section';
import { PageHeader } from '@/components/csrm/page-header';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { SaveStatus } from '@/components/csrm/save-status';
import { SegmentedControl } from '@/components/csrm/segmented-control';
import { StatusBadge } from '@/components/csrm/status-badge';
import { landOn, useHashLanding } from '@/components/csrm/use-hash-landing';
import { EmptyState } from '@/components/states/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { successToast } from '@/components/ui/success-toast';
import { toastAction } from '@/components/ui/toast-action';
import { Textarea } from '@/components/ui/textarea';
import type { RequestRelationSummary } from '@/features/requests/request-domain';
import { listControlImplementationsAction, refreshAnalystAssessmentAction, releaseAssessmentAction, saveAssessmentAction } from './assessment-actions';
import {
  type ActiveUser,
  type AiFieldReview,
  type AiSuggestionReview,
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
import { RiskEditor, type EditableRisk, type NewRiskDraft } from './risk-editor';
import type { OwnerSearchInput, OwnerSearchResult } from './owner-combobox';
import { applicableControlGroup, assessmentDetailsFormValues, assessmentRiskListItemFromAnalystRisk, assessmentSaveWrites, canMutateAssessment, changedAssessmentDetails, normalizeAssessmentDetails, riskWritableFields } from './assessment-domain';
import { missingCaption, summarizeReleaseReadiness, type ReleaseReadinessAssessmentItem, type ReleaseReadinessSummary } from './release-readiness-summary';
import { formatCalendarDate, ReleasedRiskDetails } from './released-risk-details';
import type { AiProvenanceHeaderProps } from '@/features/ai-assistance/ai-provenance-domain';
import { AiCitations } from '@/features/ai-assistance/ai-citations';
import { AiControlSuggestions } from '@/features/ai-assistance/ai-control-suggestions';
import { AiProvenanceHeader } from '@/features/ai-assistance/ai-provenance-header';
import { AiFieldMarker } from '@/features/ai-assistance/ai-field-marker';
import { AiReviewBar } from '@/features/ai-assistance/ai-review-bar';
import { fieldMarkerState, fieldsToReviewLabel, withFieldStates } from '@/features/ai-assistance/ai-assistance-domain';
import { useAiDecisions } from '@/features/ai-assistance/use-ai-decisions';
import { AssessmentLifecycleStepper } from './assessment-lifecycle-stepper';
import { AssessmentRequestLink } from './assessment-request-link';
import type { AnalystRefusal } from './assessment-detail';
import { useRecordSaveStatus } from './use-record-save-status';
import { AiProposalsSection } from '@/features/risk-curation/ai-proposals-section';
import { AiProposalsSectionLoader, ProposalsReadError } from '@/features/risk-curation/ai-proposals-section-loader';
import type { ProposalRiskRef } from '@/features/risk-curation/ai-proposals-section-client';
import { RewriteForm } from '@/features/risk-curation/rewrite-form';
import { RiskCardActions } from '@/features/risk-curation/risk-card-actions';
import {
  aiAcceptConfirmed,
  discardToast,
  overallRatingHint,
  partitionByWithdrawal,
  riskCardHref,
  riskCardId,
  showCounts,
  type CurationAct,
  type ProposalsAssessmentState,
  type RiskAiProposals,
  type RiskAiRunFacts,
  type RiskHistoryEvent,
  type RiskPerson,
  type RiskProposalJob,
} from '@/features/risk-curation/risk-curation-domain';
import { RiskHistoryDialog } from '@/features/risk-curation/risk-history-trigger';
import { useRiskWithdrawal, type RiskWithdrawalFacts } from '@/features/risk-curation/use-risk-withdrawal';
import { WithdrawRiskForm } from '@/features/risk-curation/withdraw-risk-form';
import { WithdrawnRiskCard } from '@/features/risk-curation/withdrawn-risk-card';

/*
 * D-48: a Risk card's `AI rewrite` section loads on demand, only on a card whose rewrite is queued, running, failed or has
 * open changes, so a page of Risk cards carries only the rewrite control (16-13's rewrite-form.tsx). Its `loading` gives
 * the section a Suspense boundary of its own: without one, the first load suspends the page's boundary, which hides the
 * whole editor behind its skeleton and loses the scroll position (16-15).
 */
const RiskRewriteSection = dynamic(() => import('@/features/risk-curation/risk-rewrite').then((module) => module.RiskRewriteSection), {
  loading: () => <div aria-label="Loading the AI rewrite" className="grid gap-3 rounded-lg border border-border bg-surface p-4" role="status"><Skeleton className="h-6 w-40" /><Skeleton className="h-16 w-full" /></div>,
});

/** The add control focus returns to after a create (UI-SPEC §13.4, UI-D18). */
type PendingFocus = { kind: 'add-risk' } | { kind: 'add-control'; riskId: string };

export type AssessmentEditorState = 'populated' | 'empty' | 'error' | 'permission';

/** Phase 16 D-08 (16-UI-SPEC §6.3): the Identified Risks list shown, kept in the page address as `?risks=withdrawn`. */
export type RiskFilter = 'active' | 'withdrawn';
export const RISK_FILTER_PARAM = 'risks';

export type AssessmentEditorProps = {
  /**
   * Phase 13 D-29 (13-UI-SPEC §10.2): the "AI inputs changed" block, rendered on the server by the page and handed to the
   * provenance header as its last block. A slot, so the editor's first load carries none of its code (D-34).
   */
  aiInputsChanged?: ReactNode;
  assessment?: AnalystAssessmentDetail;
  /**
   * Phase 19 (19-UI-SPEC §1, §4.1): `Print report`, then Export, rendered on the server by the page once the analyst
   * detail says the assessment is released, and placed at the header's end. None renders without it.
   */
  headerAction?: ReactNode;
  /**
   * Phase 13 D-16, D-25 (13-UI-SPEC §11): who holds the request and its notes figure, rendered on the server by the page and
   * set under the originating request link. A slot, so the editor gains no client component (D-34).
   */
  requestContext?: ReactNode;
  controlImplementations?: Readonly<Record<string, readonly ControlImplementation[]>>;
  /**
   * The AI provenance header's props (12-UI-SPEC §1), derived on the server. The header renders inside the editor's client
   * tree: as a separate client reference its sheet trigger duplicated shared chunks, about 17.8 KB on this route.
   */
  provenance?: AiProvenanceHeaderProps | null;
  /** Who a permission state is for: `role` when the route gate refused the viewer before any read (UI-SPEC §11.1). */
  refusal?: AnalystRefusal;
  risks?: readonly EditableRisk[];
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
  /** Phase 16 (16-UI-SPEC §6.3): the list the page address names; `active` unless `?risks=withdrawn`. */
  riskFilter?: RiskFilter;
  /**
   * Phase 16 D-41 (16-UI-SPEC §1, §2): the page's AI proposals read, served beside the assessment. Undefined when the page
   * read none, so no section renders; null when the read failed or was refused, with `proposalsError` or
   * `viewerRaisedRequest` saying which.
   */
  proposals?: RiskAiProposals | null;
  /** The proposals read failed: the section shows its compact error, and readiness still shows the served item. */
  proposalsError?: boolean;
  /** Strapi refused the proposals read with OWN_REQUEST: the viewer raised the originating request (§12.3). */
  viewerRaisedRequest?: boolean;
  /** The session draft owner key, so typed reasons and instructions are kept per person for the session. */
  ownerKey?: string | null;
  /** The signed-in analyst, named on a card while an act of theirs is on its way. */
  viewer?: RiskPerson | null;
};

const noRisks: readonly EditableRisk[] = [];
const noImplementations: Readonly<Record<string, readonly ControlImplementation[]>> = {};
const noRiskListItems: readonly AssessmentRiskListItem[] = [];
const noRiskTypes: readonly RiskType[] = [];
const noRequestRelations: readonly RequestRelationSummary[] = [];

/** A Risk as the curation lists read it: its withdrawal facts, null while it is active (the analyst read serves them). */
type CuratedRisk = EditableRisk & { readonly withdrawal: RiskWithdrawalFacts | null };
const curated = (risk: EditableRisk): CuratedRisk => (risk.withdrawal === undefined ? { ...risk, withdrawal: null } : risk as CuratedRisk);

/** The withdraw or reinstate form open on one card, and the control that opened it. */
type CurationForm = { readonly riskId: string; readonly mode: CurationAct; readonly opener: HTMLElement | null };

const time = (run: RiskAiRunFacts) => Date.parse(run.completedAt ?? run.startedAt ?? '') || 0;

/** §4.2: a Risk's latest completed rewrite, whose changes its `AI rewrite` section lists. */
function latestRewriteRun(proposals: RiskAiProposals, riskId: string): RiskAiRunFacts | null {
  return proposals.runs
    .filter((run) => run.operation === 'risk-rewrite' && run.riskId === riskId)
    .reduce<RiskAiRunFacts | null>((latest, run) => (latest === null || time(run) > time(latest) ? run : latest), null);
}

const jobProgress = (job: RiskProposalJob) => job.attempt * 10 + (job.status === 'queued' ? 0 : job.status === 'running' ? 1 : 2);

/**
 * FE4-05: a Risk's rewrite job, the served one or the one this page view last saw, whichever is newer: for the same job
 * the later attempt or state, else the one queued later. The server's read wins once it knows more.
 */
function latestRewriteJob(served: RiskProposalJob | null, seen: RiskProposalJob | null): RiskProposalJob | null {
  if (!served || !seen) return served ?? seen;
  if (served.jobId === seen.jobId) return jobProgress(served) > jobProgress(seen) ? served : seen;
  return Date.parse(served.queuedAt) > Date.parse(seen.queuedAt) ? served : seen;
}

/** §4.6: the figure link beside the Risk number. */
function changesToReview(count: number): string {
  return `${count.toLocaleString('en-AU')} AI ${count === 1 ? 'change' : 'changes'} to review`;
}

/** §8.3: `Show in AI proposals` lands on the decided proposal the entry names, else on the section. */
function proposalHref(event: RiskHistoryEvent): string {
  return event.aiRunId && event.proposalItem ? `#ai-proposal-${event.aiRunId}-${event.proposalItem}` : '#ai-proposals';
}

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
    ? 'Reviewing assessments is for Security Analysts. Assessments released to you are in My risk assessments.'
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
          ? <Link className={buttonVariants({ variant: 'outline' })} href="/app/assessments">Go to My risk assessments</Link>
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
      <Skeleton className="h-24 w-full rounded-lg" data-testid="ai-provenance-header-skeleton" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"><Skeleton className="h-80 w-full" /><Skeleton className="h-80 w-full" /></div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export function AssessmentEditor(props: AssessmentEditorProps) {
  const { assessment, refusal, state = 'populated' } = props;
  /*
   * The page is read again after a `Show` change and after each act (D-41). A later read that fails keeps the editor as
   * last read, with its lists and unsaved input, and says so with WR-302's warning and its Try again; a refusal or a
   * missing assessment still replaces it (pilot note 1).
   */
  const [lastRead, setLastRead] = useState<AssessmentEditorProps | null>(null);
  if (state === 'populated' && assessment && lastRead !== props) setLastRead(props);
  if (state !== 'populated' || !assessment) {
    if (state === 'error' && lastRead?.assessment) return <PopulatedAssessmentEditor {...lastRead} assessment={lastRead.assessment} readFailed />;
    return <SafeAssessmentState refusal={refusal} state={state === 'populated' ? 'empty' : state} />;
  }
  return <PopulatedAssessmentEditor {...props} assessment={assessment} />;
}

function PopulatedAssessmentEditor({
  aiInputsChanged,
  assessment,
  headerAction,
  requestContext,
  controlImplementations = noImplementations,
  ownerKey = null,
  proposals,
  proposalsError = false,
  provenance,
  riskFilter = 'active',
  risks: initialRisks = noRisks,
  riskListItems = noRiskListItems,
  riskTypes = noRiskTypes,
  requestSystems = noRequestRelations,
  requestAssets = noRequestRelations,
  relationLabels = noRelationLabels,
  searchOwners = async () => ({ ok: false, formError: 'Owner search is unavailable. Please try again later.' }),
  searchControls = unavailableSearch,
  searchSystems = unavailableSearch,
  searchAssets = unavailableSearch,
  viewer = null,
  viewerRaisedRequest = false,
  readFailed = false,
}: AssessmentEditorProps & { assessment: AnalystAssessmentDetail; readFailed?: boolean }) {
  const router = useRouter();
  const [currentAssessment, setCurrentAssessment] = useState(assessment);
  const [risks, setRisks] = useState<readonly EditableRisk[]>(initialRisks);
  const [implementations, setImplementations] = useState<Readonly<Record<string, readonly ControlImplementation[]>>>(controlImplementations);
  /*
   * The page's next read wins (D-41): a decision on an AI proposal, an added proposed risk and a finished AI job refresh
   * the page, and the assessment, its Risks and their mitigation controls it serves then replace what this view holds.
   * The forms keep their unsaved input, because they are keyed by record and not remounted.
   */
  const [served, setServed] = useState({ assessment, risks: initialRisks, controlImplementations });
  if (served.assessment !== assessment || served.risks !== initialRisks || served.controlImplementations !== controlImplementations) {
    setServed({ assessment, risks: initialRisks, controlImplementations });
    setCurrentAssessment(assessment);
    setRisks(initialRisks);
    setImplementations(controlImplementations);
  }
  const [filter, setFilter] = useState<RiskFilter>(riskFilter);
  const [servedFilter, setServedFilter] = useState<RiskFilter>(riskFilter);
  if (servedFilter !== riskFilter) {
    setServedFilter(riskFilter);
    setFilter(riskFilter);
  }
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
  /** The toast that says the last read of the assessment failed, while it is up (WR-302). */
  const notRefreshedToast = useRef<string | number | null>(null);
  /* Phase 16: the withdraw or reinstate form open on a card, the history open, the rewrite form open, and started rewrites. */
  const [curationForm, setCurationForm] = useState<CurationForm | null>(null);
  /* FE3-03: the control that opened a sent form, which a form its refusal reopens returns focus to when kept. */
  const [sentFrom, setSentFrom] = useState<{ readonly riskId: string; readonly opener: HTMLElement | null } | null>(null);
  const [history, setHistory] = useState<{ riskId: string; riskNumber: string; open: boolean } | null>(null);
  const historyOpener = useRef<HTMLElement | null>(null);
  const [rewriteOpen, setRewriteOpen] = useState<string | null>(null);
  /* FE4-05: each Risk's rewrite job as this page view last saw it (started, retried, failed or completed). */
  const [rewriteJobs, setRewriteJobs] = useState<Readonly<Record<string, RiskProposalJob>>>({});
  const noteRewriteJob = (riskId: string, job: RiskProposalJob) => setRewriteJobs((current) => ({ ...current, [riskId]: job }));
  /* FE4-01: rewrite jobs the server no longer knows (jobs are process-local), which no longer count as running. */
  const [goneRewriteJobs, setGoneRewriteJobs] = useState<ReadonlySet<string>>(() => new Set());
  const known = (job: RiskProposalJob | null) => (job && !goneRewriteJobs.has(job.jobId) ? job : null);
  /* FE4-03: the rewrite the analyst just started, whose status line takes focus once the card's section shows it. */
  const [startedRewrite, setStartedRewrite] = useState<string | null>(null);
  /* Which Risk forms hold unsaved changes: withdrawing waits for them (UI-D8), and Confirm is withheld (UI-D17). */
  const [unsavedRisks, setUnsavedRisks] = useState<ReadonlySet<string>>(() => new Set());
  /* §7 (D-17): what a discarded new Risk held, while its toast offers Undo; the reopened form starts from it. */
  const [newRiskDraft, setNewRiskDraft] = useState<NewRiskDraft | null>(null);
  /* The discard's toast while it offers Undo (FE3-16). */
  const discardToastId = useRef<string | null>(null);

  // After a create, focus returns to the add control that opened the form, once it is back on the page.
  useEffect(() => {
    if (!pendingFocus) return;
    const target = pendingFocus.kind === 'add-risk' ? addRiskButton.current : addControlButtons.current.get(pendingFocus.riskId);
    if (!target) return;
    target.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  const markAdded = (documentId: string) => setAddedAt((current) => ({ ...current, [documentId]: new Date().toISOString() }));

  const mutable = canMutateAssessment(currentAssessment);
  const readiness = currentAssessment.releaseReadiness;
  const canOfferRelease = mutable && currentAssessment.assessmentStatus === 'in-review';
  const assessmentId = currentAssessment.documentId;
  const requestId = currentAssessment.assessmentRequest.documentId;

  /*
   * After every accepted change the server's answer is applied first, then the assessment is read again for the
   * release facts that change derives (CR-201). A failed read keeps what the answers already applied, so no form
   * compares with page-load values and no new Risk is hidden, and says so in a warning toast whose Try again reads
   * the assessment again in place (WR-302; a reload would discard unsaved input, WR-303).
   */
  function warnNotRefreshed(retry: () => void) {
    notRefreshedToast.current = toast.warning('Assessment not refreshed', {
      id: notRefreshedToast.current ?? undefined,
      description: 'We couldn’t load this assessment’s latest review state and release readiness, so the page may be out of date. Try again.',
      duration: Infinity,
      action: { label: 'Try again', onClick: retry },
    });
  }

  function dismissNotRefreshed() {
    if (notRefreshedToast.current !== null) toast.dismiss(notRefreshedToast.current);
    notRefreshedToast.current = null;
  }

  /* Pilot note 1: a later read of the page failed, so the editor shows the last read; Try again reads the page again. */
  useEffect(() => {
    if (readFailed) warnNotRefreshed(() => router.refresh());
    else dismissNotRefreshed();
  }, [readFailed]);

  async function refreshAssessment(): Promise<void> {
    let result: Awaited<ReturnType<typeof refreshAnalystAssessmentAction>> | null;
    try {
      result = await refreshAnalystAssessmentAction({ assessmentId });
    } catch {
      result = null;
    }
    if (!result?.ok) {
      warnNotRefreshed(() => { void refreshAssessment(); });
      return;
    }
    dismissNotRefreshed();
    setCurrentAssessment(result.data);
    setRisks(result.data.risks);
  }
  /* FE3-05 (16-UI-SPEC §6.5): a change refused because its Risk was withdrawn meanwhile reads the Risks again. */
  const readAgain = () => { void refreshAssessment(); };

  /*
   * Phase 16 (16-UI-SPEC §6.1, §6.2; X-27): withdraw and reinstate move a card at once and read the assessment again once
   * Strapi records the act, so the Show counts, readiness and the Risks follow the server. Strapi decides every act.
   */
  const curatedRisks = useMemo(() => risks.map(curated), [risks]);
  const withdrawal = useRiskWithdrawal({ assessmentId, risks: curatedRisks, viewer, draftOwnerKey: ownerKey, onChanged: refreshAssessment });
  const counts = showCounts(withdrawal.risks);
  const lists = partitionByWithdrawal(withdrawal.risks);

  /* WR-302: a decision Strapi accepted holds in the page's copy of the record until the next read replaces it. */
  function applyReviewedRisk(riskId: string, names: readonly string[], state: AiFieldReview['state']) {
    setRisks((current) => current.map((item) => (item.documentId === riskId && item.aiProvenance ? { ...item, aiProvenance: withFieldStates(item.aiProvenance, names, state) } : item)));
  }

  function applyReviewedDetails(names: readonly string[], state: AiFieldReview['state']) {
    setCurrentAssessment((current) => (current.aiProvenance ? { ...current, aiProvenance: withFieldStates(current.aiProvenance, names, state) } : current));
  }

  function applyReviewedSuggestion(riskId: string, key: string, state: AiSuggestionReview['state']) {
    setRisks((current) => current.map((item) => (item.documentId === riskId && item.aiProvenance
      ? { ...item, aiProvenance: { ...item.aiProvenance, suggestions: item.aiProvenance.suggestions.map((suggestion) => (suggestion.key === key ? { ...suggestion, state } : suggestion)) } }
      : item)));
  }

  /* After an AI suggestion adds or removes a planned control, the Risk's list is read again (12-UI-SPEC §5). */
  async function reloadImplementations(riskId: string): Promise<void> {
    const result = await listControlImplementationsAction({ riskId });
    if (result.ok) setImplementations((current) => ({ ...current, [riskId]: result.data }));
  }

  /* D-21 (WR-302): Strapi marked each AI field the save changed `edited`; the page's copy shows it before the read. */
  function applySavedAssessment(saved: AssessmentDetail, changedFields: readonly string[]) {
    setCurrentAssessment((current) => ({
      ...current,
      ...saved,
      aiProvenance: current.aiProvenance ? withFieldStates(current.aiProvenance, changedFields, 'edited') : current.aiProvenance,
    }));
    void refreshAssessment();
  }

  function applySavedRisk(saved: EditableRisk, changedFields: readonly string[]) {
    setRisks((current) => current.map((item) => (item.documentId === saved.documentId
      ? { ...saved, aiProvenance: item.aiProvenance ? withFieldStates(item.aiProvenance, changedFields, 'edited') : item.aiProvenance }
      : item)));
    void refreshAssessment();
  }

  function applyCreatedRisk(created: AnalystRisk) {
    setRisks((current) => (current.some((item) => item.documentId === created.documentId) ? current : [...current, created]));
    markAdded(created.documentId);
    setAddingRisk(false);
    setNewRiskDraft(null);
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
    const result = await releaseAssessmentAction({ assessmentId });
    if (!result?.ok) {
      setReleaseError(result?.formError ?? 'The assessment service is unavailable. Please try again later.');
      throw new Error('Release failed');
    }
    setCurrentAssessment((current) => ({ ...current, ...result.data }));
  }

  /*
   * §6.3: the choice shows at once and is kept in the page address through the router, with no scroll, so focus stays on
   * the option. A native history.replaceState left the router's tree keyed to the loaded address, and the next action's
   * refreshed page then counted as a new page and scrolled to its top (16-15). The router reads the page once for the
   * new address; the editor keeps its state and unsaved input, as on any refresh.
   */
  function chooseFilter(next: RiskFilter) {
    setFilter(next);
    const url = new URL(window.location.href);
    if (next === 'withdrawn') url.searchParams.set(RISK_FILTER_PARAM, 'withdrawn');
    else url.searchParams.delete(RISK_FILTER_PARAM);
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }

  /*
   * FE3-06: a link to a Risk card, or to its `AI rewrite`, in the list not shown chooses that list, then lands there once
   * it shows. A link to a card in the list shown lands as before.
   * FE3-07 (§8.3): `Show in AI proposals` in the modal history sheet closes the sheet, with no return of focus to its
   * opener, then lands on the proposal once the sheet has let focus go.
   */
  const [landing, setLanding] = useState<string | null>(null);
  useHashLanding((id) => {
    if (history?.open && (id === 'ai-proposals' || id.startsWith('ai-proposal-'))) {
      historyOpener.current = null;
      setHistory({ ...history, open: false });
      setLanding(id);
      return;
    }
    const named = withdrawal.risks.find((risk) => id === riskCardId(risk.documentId) || id === riskCardId(risk.documentId, '-rewrite'));
    const list: RiskFilter | null = named ? (named.withdrawal ? 'withdrawn' : 'active') : null;
    if (!list || list === filter) return;
    chooseFilter(list);
    setLanding(id);
  });
  useEffect(() => {
    if (!landing) return;
    setLanding(null);
    const target = document.getElementById(landing);
    if (target) landOn(target);
  }, [landing]);

  /*
   * §7 (D-17, UI-D28): Discard new risk closes the form at once and focus returns to Add Risk. A form that held input
   * offers Undo, which reopens it with what was typed and focus in its first field; an untouched one closes silently.
   * Nothing is sent, so nothing is recorded.
   */
  function discardNewRisk(draft: NewRiskDraft | null) {
    setAddingRisk(false);
    setNewRiskDraft(null);
    setPendingFocus({ kind: 'add-risk' });
    if (!draft) return;
    discardToastId.current = successToast(discardToast(), {
      action: toastAction('Undo', () => {
        discardToastId.current = null;
        setNewRiskDraft(draft);
        setAddingRisk(true);
      }),
    });
  }

  /* FE3-16: a new Add Risk form withdraws the discard's toast, whose Undo could no longer reopen what was discarded. */
  function addRisk() {
    if (discardToastId.current !== null) toast.dismiss(discardToastId.current);
    discardToastId.current = null;
    setNewRiskDraft(null);
    setAddingRisk(true);
  }

  function noteUnsaved(riskId: string, unsaved: boolean) {
    setUnsavedRisks((current) => {
      if (current.has(riskId) === unsaved) return current;
      const next = new Set(current);
      if (unsaved) next.add(riskId);
      else next.delete(riskId);
      return next;
    });
  }

  function openHistory(risk: CuratedRisk, opener: HTMLElement | null) {
    historyOpener.current = opener;
    setHistory({ riskId: risk.documentId, riskNumber: risk.riskNumber, open: true });
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
  // The shared read-only Risk (D-34): the served list item, or one named from the labels this view holds.
  const readOnlyRisk = (risk: AnalystRisk) => riskListItems.find((item) => item.documentId === risk.documentId)
    ?? assessmentRiskListItemFromAnalystRisk(risk, {
      users: currentAssessment.ownerLabels,
      systems: [...requestSystems, ...labelledRecords],
      assets: [...requestAssets, ...labelledRecords],
    });

  /*
   * Phase 16 (16-UI-SPEC §2.4, §12.1, §12.3): what the AI proposals read lets this viewer do. The analyst who raised the
   * request is served no proposals (OWN_REQUEST), so nothing of them shows. These are courtesies: Strapi decides each act.
   */
  const released = currentAssessment.assessmentStatus === 'approved' || currentAssessment.assessmentStatus === 'closed';
  const proposalsState: ProposalsAssessmentState = mutable ? 'editable' : released ? 'released' : 'not-editable';
  const proposalsView = viewerRaisedRequest ? null : proposals ?? null;
  const aiOpen = mutable && proposalsView !== null && proposalsView.editable;
  const rewriteAllowed = aiOpen && proposalsView.actions.rewrite.allowed;
  const decideAllowed = aiOpen && proposalsView.actions.decide.allowed;
  const openChangesOf = (riskId: string) => proposalsView?.openByRisk.find((entry) => entry.riskId === riskId)?.count ?? 0;
  const showsProposals = proposals !== undefined || proposalsError || viewerRaisedRequest;
  const proposalRisks: ProposalRiskRef[] = curatedRisks.map((risk) => ({ id: risk.documentId, riskNumber: risk.riskNumber, values: proposalRiskValues(risk, riskTypes) }));

  function curationFormFor(risk: CuratedRisk, mode: CurationAct): ReactNode {
    const riskId = risk.documentId;
    const refused = withdrawal.refusal?.riskId === riskId && withdrawal.refusal.mode === mode ? withdrawal.refusal : null;
    const open = curationForm?.riskId === riskId && curationForm.mode === mode;
    if (!refused && !open) return null;
    const opener = curationForm?.riskId === riskId ? curationForm.opener : sentFrom?.riskId === riskId ? sentFrom.opener : null;
    const close = () => {
      setCurationForm(null);
      withdrawal.clearRefusal();
    };
    return (
      <WithdrawRiskForm
        draftOwnerKey={ownerKey}
        error={refused?.message ?? null}
        hasUnsavedChanges={mode === 'withdraw' && unsavedRisks.has(riskId)}
        initialReason={refused?.reason}
        key={refused ? `refused-${refused.attempt}` : 'open'}
        mode={mode}
        onKeep={close}
        onSubmit={(reason) => {
          setSentFrom({ riskId, opener });
          close();
          if (mode === 'withdraw') withdrawal.withdraw(risk, reason);
          else withdrawal.reinstate(risk, reason);
        }}
        openChanges={viewerRaisedRequest ? null : openChangesOf(riskId)}
        returnFocusTo={opener}
        riskId={riskId}
        riskNumber={risk.riskNumber}
      />
    );
  }

  function activeRiskCard(risk: CuratedRisk): ReactNode {
    const riskId = risk.documentId;
    const openChanges = viewerRaisedRequest || !mutable ? 0 : openChangesOf(riskId);
    const latestJob = latestRewriteJob(
      known(proposalsView?.jobs.find((job) => job.operation === 'risk-rewrite' && job.riskId === riskId && job.status !== 'completed') ?? null),
      known(rewriteJobs[riskId] ?? null),
    );
    const rewriteJob = latestJob?.status === 'completed' ? null : latestJob;
    /* A rewrite that finished this page view keeps its section, so a no-change outcome stays said after the page's next read. */
    const showsRewrite = mutable && proposalsView !== null && (latestJob !== null || openChanges > 0);
    /* §4.1 (FE4-04): never offered while this Risk's rewrite is queued or running. */
    const rewriting = rewriteJob?.status === 'queued' || rewriteJob?.status === 'running';
    const actions = mutable ? (
      <RiskCardActions
        onHistory={(opener) => openHistory(risk, opener)}
        onWithdraw={(opener) => {
          withdrawal.clearRefusal();
          setCurationForm({ riskId, mode: 'withdraw', opener });
        }}
        requestingAnalyst={viewerRaisedRequest}
        rewrite={rewriteAllowed && !rewriting ? {
          trigger: (
            <RewriteForm
              assessmentId={assessmentId}
              onOpenChange={(open) => setRewriteOpen(open ? riskId : null)}
              onStarted={(job) => { noteRewriteJob(riskId, job); setStartedRewrite(job.jobId); }}
              open={rewriteOpen === riskId}
              openChanges={openChanges}
              ownerKey={ownerKey}
              riskId={riskId}
              riskNumber={risk.riskNumber}
            />
          ),
          open: () => setRewriteOpen(riskId),
        } : null}
        riskId={riskId}
        riskNumber={risk.riskNumber}
        withdrawOpen={curationForm?.riskId === riskId && curationForm.mode === 'withdraw'}
      />
    ) : (
      /* The page's one history sheet, so `Show in AI proposals` can close it (FE3-07). */
      <Button aria-haspopup="dialog" aria-label={`History of ${risk.riskNumber}`} className="max-md:min-h-11" data-print="hidden" onClick={(event) => openHistory(risk, event.currentTarget)} size="sm" type="button" variant="ghost">
        <History aria-hidden="true" />History
      </Button>
    );

    return (
      <Card
        className="min-w-0 transition-opacity duration-(--duration-base) ease-standard data-[pending=true]:opacity-60 data-[pending=true]:transition-none"
        data-pending={withdrawal.pending.has(riskId)}
        data-risk-card=""
        id={riskCardId(riskId)}
        key={riskId}
        tabIndex={-1}
      >
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="min-w-0 break-words">{risk.riskNumber}</CardTitle>
            {risk.residualRating ? <RiskRatingBadge rating={risk.residualRating} /> : null}
            {mutable ? <RiskProposalsBadge provenance={risk.aiProvenance} /> : null}
            {openChanges > 0 ? <a className="record-link text-xs font-medium tabular-nums" href={riskCardHref(riskId, '-rewrite')}>{changesToReview(openChanges)}</a> : null}
            <div className="ml-auto flex items-center">{actions}</div>
          </div>
          <CardDescription>{risk.riskStatement || 'Risk statement not provided'}</CardDescription>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-6">
          {mutable ? curationFormFor(risk, 'withdraw') : null}
          {showsRewrite ? (
            <RiskRewriteSection
              assessmentId={assessmentId}
              decide={decideAllowed}
              focusJob={startedRewrite}
              formHasUnsavedChanges={unsavedRisks.has(riskId)}
              items={proposalsView.items}
              job={rewriteJob}
              onJobChange={(job) => noteRewriteJob(riskId, job)}
              onJobFocused={() => setStartedRewrite(null)}
              onJobGone={(job) => setGoneRewriteJobs((current) => new Set([...current, job.jobId]))}
              ownerKey={ownerKey}
              requestId={requestId}
              risk={{
                id: riskId,
                riskNumber: risk.riskNumber,
                values: {
                  residualRating: risk.residualRating,
                  residualLikelihood: risk.residualLikelihood,
                  highestResidualConsequence: risk.highestResidualConsequence,
                  treatmentPlan: risk.treatmentPlan,
                  treatmentAction: risk.treatmentAction,
                  aiAcceptConfirmed: aiAcceptConfirmed(risk.aiProvenance),
                },
                controlImplementations: implementations[riskId] ?? [],
              }}
              run={latestRewriteRun(proposalsView, riskId)}
              viewer={viewer}
            />
          ) : null}
          {mutable ? (
            <>
              <RiskEditor addedAt={addedAt[riskId]} assessmentId={assessmentId} mode="edit" onDecision={refreshAssessment} onReviewed={(names, state) => applyReviewedRisk(riskId, names, state)} onRiskWithdrawn={readAgain} onUnsavedChange={(unsaved) => noteUnsaved(riskId, unsaved)} requestId={requestId} onRelationChosen={rememberRelation} onUpdated={applySavedRisk} options={options} risk={risk} searchOwners={searchOwners} />
              <section aria-label={`Mitigation controls for ${risk.riskNumber}`} className="grid gap-4">
                <h3 className="text-heading-sm">Mitigation controls</h3>
                {(implementations[riskId] ?? []).map((implementation) => (
                  <ControlImplementationEditor
                    addedAt={addedAt[implementation.documentId]}
                    assessmentId={assessmentId}
                    implementation={implementation}
                    key={implementation.documentId}
                    mode="edit"
                    onUpdated={(saved) => applySavedImplementation(riskId, saved)}
                    onRiskWithdrawn={readAgain}
                    onRemoved={(implementationId) => { setImplementations((current) => ({ ...current, [riskId]: (current[riskId] ?? []).filter((item) => item.documentId !== implementationId) })); void refreshAssessment(); }}
                    options={controlOptionsFor(risk)}
                    riskId={riskId}
                  />
                ))}
                {addingControlTo === riskId ? <ControlImplementationEditor assessmentId={assessmentId} focusControlOnOpen mode="create" onCreated={(created) => { setImplementations((current) => ({ ...current, [riskId]: [...(current[riskId] ?? []), created] })); markAdded(created.documentId); setAddingControlTo(null); setPendingFocus({ kind: 'add-control', riskId }); void refreshAssessment(); }} onRiskWithdrawn={readAgain} options={controlOptionsFor(risk)} riskId={riskId} /> : null}
                {risk.aiProvenance ? (
                  <AiControlSuggestions
                    assessmentId={assessmentId}
                    onControlsChanged={() => reloadImplementations(riskId)}
                    onReviewed={(key, state) => applyReviewedSuggestion(riskId, key, state)}
                    onUpdated={refreshAssessment}
                    riskId={riskId}
                    riskNumber={risk.riskNumber}
                    suggestions={risk.aiProvenance.suggestions}
                  />
                ) : null}
                {addingControlTo !== riskId ? (
                  <Button
                    className="justify-self-start"
                    onClick={() => setAddingControlTo(riskId)}
                    ref={(element) => {
                      if (element) addControlButtons.current.set(riskId, element);
                      else addControlButtons.current.delete(riskId);
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
            <ReleasedRiskDetails groupHeadingLevel={3} implementations={implementations[riskId] ?? []} risk={readOnlyRisk(risk)} />
          )}
        </CardContent>
      </Card>
    );
  }

  /* §6.4 (X-27): collapsed and read-only, `Reinstate risk` only while the assessment can change, History always. */
  function withdrawnRiskCard(risk: CuratedRisk, facts: RiskWithdrawalFacts): ReactNode {
    const riskId = risk.documentId;
    return (
      <WithdrawnRiskCard
        details={<ReleasedRiskDetails groupHeadingLevel={4} implementations={implementations[riskId] ?? []} risk={readOnlyRisk(risk)} />}
        editable={mutable}
        form={mutable ? curationFormFor(risk, 'reinstate') : null}
        key={riskId}
        onHistory={(opener) => openHistory(risk, opener)}
        onReinstate={(opener) => {
          withdrawal.clearRefusal();
          setCurationForm({ riskId, mode: 'reinstate', opener });
        }}
        pending={withdrawal.pending.has(riskId)}
        reinstateOpen={curationForm?.riskId === riskId && curationForm.mode === 'reinstate'}
        risk={{ documentId: riskId, riskNumber: risk.riskNumber, riskStatement: risk.riskStatement, residualRating: risk.residualRating, withdrawal: facts }}
      />
    );
  }

  const showOptions = [
    { value: 'active', label: `Active (${counts.active.toLocaleString('en-AU')})` },
    { value: 'withdrawn', label: `Withdrawn (${counts.withdrawn.toLocaleString('en-AU')})` },
  ] as const;

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        action={headerAction}
        status={<StatusBadge family="assessment" live value={currentAssessment.assessmentStatus} />}
        description={currentAssessment.assessmentNumber}
        title="Risk assessment review"
      />
      <AssessmentRequestLink actor={currentAssessment.actor} request={currentAssessment.assessmentRequest} requestContext={requestContext} />
      <AssessmentLifecycleStepper status={currentAssessment.assessmentStatus} />
      {/* §10.1: the open AI proposals link to the section; never for the analyst who raised the request, nor once released. */}
      {provenance ? <AiProvenanceHeader aiInputsChanged={aiInputsChanged} {...provenance} openProposals={!provenance.released && proposalsView ? proposalsView.openCount : null} /> : null}
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

      {/*
        * Walk D13(a) (12-UI-SPEC §10.2): release readiness is for a record that can still be released. Strapi projects it
        * for every record, a released one included, whose status requirement then reads outstanding; once the assessment
        * can no longer change, the card does not render and the details take the full width.
        */}
      <div className={mutable ? 'grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]' : 'grid min-w-0 gap-6'}>
        <AssessmentMetadata assessment={currentAssessment} mutable={mutable} onDecision={refreshAssessment} onReviewed={applyReviewedDetails} onUpdated={applySavedAssessment} risks={withdrawal.risks} />
        {mutable ? (
          <Card>
            <CardHeader>
              <h2 className="text-heading-sm">Release readiness</h2>
              <CardDescription>Every requirement must be met before release. We check them all again when you release.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ReleaseReadinessRequirements summary={summarizeReleaseReadiness(readiness, { openCount: proposalsView?.openCount ?? null, viewerRaisedRequest })} />
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
        ) : null}
      </div>

      {/* §1 and §2 (D-45, UI-D2): the AI proposals section, directly before Identified Risks; its body loads on demand (D-48). */}
      {showsProposals ? (
        <AiProposalsSection assessmentId={assessmentId} state={proposalsState} viewerRaisedRequest={viewerRaisedRequest}>
          {proposalsView
            ? <AiProposalsSectionLoader assessmentId={assessmentId} ownerKey={ownerKey} proposals={proposalsView} requestId={requestId} risks={proposalRisks} state={proposalsState} viewer={viewer} />
            : <ProposalsReadError />}
        </AiProposalsSection>
      ) : null}

      <DetailSection description="Risks identified in this assessment, with their ratings, treatment and mitigation controls." headingFocusable headingId="identified-risks" title="Identified Risks">
        <div className="grid min-w-0 gap-5">
          {/* §6.3: `Show`, with each count equal to its list (X-10); the address keeps the choice. */}
          <div className="tabular-nums" data-print="hidden" data-risk-show="">
            <SegmentedControl label="Show" onValueChange={chooseFilter} options={showOptions} value={filter} />
          </div>
          {/* FE3-01: both lists stay mounted and the one not chosen is hidden, so a Show change never loses unsaved input. */}
          <div className="grid min-w-0 gap-5" data-risk-list="active" hidden={filter !== 'active'}>
            {lists.active.length > 0 ? lists.active.map(activeRiskCard) : counts.withdrawn > 0 ? (
              <EmptyState density="compact" description="Every risk in this assessment has been withdrawn. Add a risk, ask the AI for more risks, or reinstate one under Withdrawn." headingLevel="h3" kind="cleared" noun="active risks" />
            ) : <p className="text-sm text-muted-foreground">No Risks have been identified.</p>}
            {mutable && addingRisk ? <Card><CardHeader><CardTitle>Add Risk</CardTitle></CardHeader><CardContent><RiskEditor assessmentId={assessmentId} draft={newRiskDraft ?? undefined} focusFirstField={newRiskDraft !== null} mode="create" onCreated={applyCreatedRisk} onDiscard={discardNewRisk} onRelationChosen={rememberRelation} options={options} searchOwners={searchOwners} /></CardContent></Card> : null}
            {mutable && !addingRisk ? <Button className="justify-self-start" onClick={addRisk} ref={addRiskButton} type="button"><PlusIcon aria-hidden="true" />Add Risk</Button> : null}
          </div>
          <div className="grid min-w-0 gap-5" data-risk-list="withdrawn" hidden={filter !== 'withdrawn'}>
            {lists.withdrawn.length > 0
              ? lists.withdrawn.map((risk) => (risk.withdrawal ? withdrawnRiskCard(risk, risk.withdrawal) : null))
              : <EmptyState density="compact" description={mutable ? 'Risks you withdraw are kept here with their reasons, and can be reinstated while the assessment is being edited.' : 'No risk was withdrawn from this assessment.'} headingLevel="h3" kind="cleared" noun="withdrawn risks" />}
          </div>
        </div>
      </DetailSection>
      {history ? (
        <RiskHistoryDialog
          key={history.riskId}
          onOpenChange={(open) => setHistory((current) => (current ? { ...current, open } : current))}
          open={history.open}
          ownerKey={ownerKey}
          proposalHref={viewerRaisedRequest ? undefined : proposalHref}
          returnFocusTo={historyOpener}
          riskId={history.riskId}
          riskNumber={history.riskNumber}
        />
      ) : null}
    </div>
  );
}

/*
 * The values `Compare with …` reads for a Risk on the page (16-UI-SPEC §3.3): its text fields as served, and its Risk Type
 * by name, as a proposed risk names it. Relations to people, systems and assets are not compared.
 */
function proposalRiskValues(risk: EditableRisk, riskTypes: readonly RiskType[]): Readonly<Record<string, string | null>> {
  const values: Record<string, string | null> = {};
  for (const field of riskWritableFields) {
    const value = risk[field];
    values[field] = typeof value === 'string' ? value : null;
  }
  values.riskType = riskTypes.find((type) => type.documentId === risk.riskType)?.name ?? null;
  for (const field of ['riskOwner', 'treatmentOwner', 'informationSystemImpacted', 'informationAssetImpacted'] as const) delete values[field];
  return values;
}

/*
 * 12-UI-SPEC §3.3 (WR-305, walk D5): a Risk with proposed fields shows the `AI proposed` badge, its name extended by
 * visually hidden text after the label to `AI proposed: {n} {field|fields} to review`. An `aria-label` on the generic
 * span that wrapped it was ignored by assistive technology (ARIA 1.2 prohibits naming the generic role).
 */
function RiskProposalsBadge({ provenance }: { provenance: EditableRisk['aiProvenance'] }) {
  const count = provenance?.fields.filter((fact) => fact.state === 'proposed').length ?? 0;
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center">
      <StatusBadge family="aiReview" value="proposed" />
      <span className="sr-only">: {fieldsToReviewLabel(count)}</span>
    </span>
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

/** An assessment item's label: a link to where it is met, or plain text when it has no link (16-UI-SPEC §9.1). */
function ReadinessItemLabel({ item }: { item: ReleaseReadinessAssessmentItem }) {
  return item.href ? <a className={readinessLinkClass} href={item.href}>{item.label}</a> : <span className="min-w-0 break-words">{item.label}</span>;
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
              <ReadinessItemLabel item={item} />
              <ReadinessState met={false}>Outstanding</ReadinessState>
              {/* 16-UI-SPEC §9.1: `{n} open` under Decisions on AI proposals, or the requesting analyst's sentence. */}
              {item.caption ? <p className="break-words text-xs tabular-nums text-muted-foreground sm:basis-full">{item.caption}</p> : null}
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
                <ReadinessItemLabel item={item} />
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

function AssessmentMetadata({ assessment, mutable, onDecision, onReviewed, onUpdated, risks }: {
  assessment: AnalystAssessmentDetail;
  mutable: boolean;
  /** Phase 16 D-15: the Risks as shown, active and withdrawn; the overall-rating hint reads the active ones. */
  risks: readonly { readonly withdrawal: RiskWithdrawalFacts | null; readonly residualRating: string | null }[];
  onDecision: () => Promise<void>;
  /** WR-302: applies a decision Strapi accepted to the details' AI facts, before the read that follows. */
  onReviewed: (names: readonly string[], state: AiFieldReview['state']) => void;
  /** The saved details, and the fields the save changed: Strapi marks an AI-written one among them `edited` (D-21). */
  onUpdated: (saved: AssessmentDetail, changedFields: readonly string[]) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const loaded = assessmentDetailsFormValues(assessment);
  const form = useForm<AssessmentUpdateInput>({ defaultValues: loaded });
  const formRef = useRef<HTMLFormElement>(null);
  const decisions = useAiDecisions({ assessmentId: assessment.documentId, target: { kind: 'assessment' }, fields: assessment.aiProvenance?.fields ?? [], place: 'in the assessment details', formRef, onUpdated: onDecision, onReviewed });
  const provenance = assessment.aiProvenance ? { ...assessment.aiProvenance, fields: decisions.fields } : null;
  const values = form.watch();
  const changedFields = new Set(provenance?.fields.filter((fact) => fieldMarkerState(fact, values[fact.field as keyof AssessmentUpdateInput], loaded[fact.field as keyof AssessmentUpdateInput]) === 'changed').map((fact) => fact.field) ?? []);
  const markerId = (name: keyof AssessmentUpdateInput) => `assessment-${name}-ai-marker`;
  const citations = (name: keyof AssessmentUpdateInput, label: string) => {
    const sources = provenance?.fields.find((fact) => fact.field === name)?.sources;
    return sources ? <AiCitations fieldLabel={label} requestId={assessment.assessmentRequest.documentId} sources={sources} /> : null;
  };
  const marker = (name: keyof AssessmentUpdateInput, label: string) => <AiFieldMarker field={name} id={markerId(name)} label={label} onConfirm={() => decisions.confirm(name)} pending={decisions.pendingFields.has(name)} state={fieldMarkerState(provenance?.fields.find((fact) => fact.field === name), values[name], loaded[name])} />;
  /*
   * 16-UI-SPEC §9.2 (D-15, UI-D25): while editable, a line under Overall rating when the highest residual rating of the
   * active Risks differs from it, named by the field's description. `Use {rating}` only sets the field, so the details
   * save as any edit does; the hint never writes and never blocks release.
   */
  const hint = overallRatingHint({ editable: mutable, overallRating: values.overallRating || null, risks });
  const hintId = 'assessment-overallRating-hint';
  const describedBy = (name: keyof AssessmentUpdateInput, error?: string) => [provenance?.fields.some((fact) => fact.field === name) ? markerId(name) : null, name === 'overallRating' && hint ? hintId : null, error ? `${name}-error` : null].filter(Boolean).join(' ') || undefined;
  const confirmation = useRecordSaveStatus(form.watch);
  function applyHintedRating(rating: NonNullable<AssessmentUpdateInput['overallRating']>) {
    form.setValue('overallRating', rating, { shouldDirty: true });
    document.getElementById('assessment-overallRating')?.focus();
  }
  const ratingHint = hint ? (
    <div className="grid gap-2">
      <p className="flex items-start gap-1.5 text-xs text-foreground-secondary" id={hintId}><InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{hint.line}</p>
      <Button className="justify-self-start max-md:min-h-11" onClick={() => applyHintedRating(hint.highest)} size="sm" type="button" variant="outline">{hint.actionLabel}</Button>
    </div>
  ) : null;

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
    onUpdated(result.data, changedAssessmentDetails(values, assessment));
  }

  if (!mutable) {
    return <DetailSection description="Assessment context and analyst conclusion." headingFocusable headingId="assessment-details" title="Assessment details"><dl className="grid gap-4 sm:grid-cols-2"><DetailValue label="Summary" value={assessment.summary} /><DetailValue label="Overall rating" value={assessment.overallRating} /><DetailValue label="Overall control effectiveness" value={assessment.overallControlEffectiveness} /><DetailValue label="Overall risk rationale" value={assessment.overallRiskRationale} /><DetailValue label="Recommendations" value={assessment.recommendationsSummary} /><DetailValue label="Next review date" value={assessment.nextReviewDate ? formatCalendarDate(assessment.nextReviewDate) : null} /></dl></DetailSection>;
  }

  return (
    <DetailSection description="Record the assessment’s summary, overall rating and recommendations." headingFocusable headingId="assessment-details" title="Assessment details">
      <form className="grid gap-5" noValidate onSubmit={form.handleSubmit(submit)} ref={formRef}>
        <AiReviewBar changedFields={changedFields} onConfirmRemaining={decisions.confirmRemaining} pending={decisions.isPending} place={{ kind: 'assessment' }} provenance={provenance} />
        {formError ? <Alert variant="destructive"><AlertTitle>Assessment not saved</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
        <MetadataFieldErrorInput error={form.formState.errors.summary?.message} after={citations('summary', 'Summary')} label="Summary" marker={marker('summary', 'Summary')}><Textarea aria-describedby={describedBy('summary', form.formState.errors.summary?.message)} aria-invalid={Boolean(form.formState.errors.summary)} id="assessment-summary" {...form.register('summary')} /></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.overallRating?.message} after={ratingHint} label="Overall rating" marker={marker('overallRating', 'Overall rating')}><select aria-describedby={describedBy('overallRating', form.formState.errors.overallRating?.message)} aria-invalid={Boolean(form.formState.errors.overallRating)} className="h-9 rounded-md border border-input bg-surface px-3 text-sm" id="assessment-overallRating" {...form.register('overallRating')}><option value="">Not specified</option>{['Low', 'Moderate', 'High', 'Critical'].map((value) => <option key={value}>{value}</option>)}</select></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.overallControlEffectiveness?.message} label="Overall control effectiveness"><select aria-describedby={form.formState.errors.overallControlEffectiveness ? 'overallControlEffectiveness-error' : undefined} aria-invalid={Boolean(form.formState.errors.overallControlEffectiveness)} className="h-9 rounded-md border border-input bg-surface px-3 text-sm" id="assessment-overallControlEffectiveness" {...form.register('overallControlEffectiveness')}><option value="">Not specified</option>{['Effective', 'Partially Effective', 'Ineffective', 'Not Assessed'].map((value) => <option key={value}>{value}</option>)}</select></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.overallRiskRationale?.message} after={citations('overallRiskRationale', 'Overall risk rationale')} label="Overall risk rationale" marker={marker('overallRiskRationale', 'Overall risk rationale')}><Textarea aria-describedby={describedBy('overallRiskRationale', form.formState.errors.overallRiskRationale?.message)} aria-invalid={Boolean(form.formState.errors.overallRiskRationale)} id="assessment-overallRiskRationale" {...form.register('overallRiskRationale')} /></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.recommendationsSummary?.message} after={citations('recommendationsSummary', 'Recommendations')} label="Recommendations" marker={marker('recommendationsSummary', 'Recommendations')}><Textarea aria-describedby={describedBy('recommendationsSummary', form.formState.errors.recommendationsSummary?.message)} aria-invalid={Boolean(form.formState.errors.recommendationsSummary)} id="assessment-recommendationsSummary" {...form.register('recommendationsSummary')} /></MetadataFieldErrorInput>
        <MetadataFieldErrorInput error={form.formState.errors.nextReviewDate?.message} label="Next review date"><Input aria-describedby={form.formState.errors.nextReviewDate ? 'nextReviewDate-error' : undefined} aria-invalid={Boolean(form.formState.errors.nextReviewDate)} id="assessment-nextReviewDate" type="date" {...form.register('nextReviewDate')} /></MetadataFieldErrorInput>
        {/* X-1: the confirmation sits beside Save from 640px and below it on a phone. */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center" data-slot="form-actions">
          <Button disabled={form.formState.isSubmitting} type="submit">Save assessment</Button>
          <SaveStatus savedLabel={(time) => <>Assessment details saved at {time}</>} status={confirmation.status} />
        </div>
      </form>
    </DetailSection>
  );
}

function MetadataFieldErrorInput({ after, children, error, label, marker }: { after?: ReactNode; children: React.ReactNode; error?: string; label: string; marker?: ReactNode }) {
  const id = `${label === 'Summary' ? 'summary' : label === 'Overall rating' ? 'overallRating' : label === 'Overall control effectiveness' ? 'overallControlEffectiveness' : label === 'Overall risk rationale' ? 'overallRiskRationale' : label === 'Recommendations' ? 'recommendationsSummary' : 'nextReviewDate'}-error`;
  return <div className="grid gap-2"><div className="flex flex-wrap items-center gap-2"><label className="text-sm font-medium" htmlFor={`assessment-${id.replace('-error', '')}`}>{label}</label>{marker}</div>{children}{error ? <span className="flex items-start gap-1 text-sm text-destructive" id={id}><AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</span> : null}{after}</div>;
}

function DetailValue({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value || 'Not provided'}</dd></div>;
}

