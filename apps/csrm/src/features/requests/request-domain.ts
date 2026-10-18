import type { AiInputsChanged } from '@/features/ai-assistance/ai-assistance-domain';
import type { RequestAssignment } from '@/features/request-assignment/assignment-domain';
import type { NotesClosedReason } from '@/features/request-notes/notes-domain';

export const requestStatuses = [
  'draft',
  'submitted',
  'questionnaire-in-progress',
  'risk-assessment-drafted',
  'under-review',
  'approved',
  'closed',
] as const;

export type RequestStatus = (typeof requestStatuses)[number];

export const requestLifecycleStepKeys = [
  'draft', 'submitted', 'questionnaire-generated', 'questionnaire-released',
  'questionnaire-submitted', 'assessment-drafted', 'assessment-reviewed', 'assessment-released',
] as const;
export type RequestLifecycleStepKey = (typeof requestLifecycleStepKeys)[number];
export type RequestLifecycleStepState = 'completed' | 'current' | 'future';
export type RequestLifecycleStep = { key: RequestLifecycleStepKey; label: string; state: RequestLifecycleStepState };
/** Who holds the work at a lifecycle step (D-20), served beside the viewer (actor); the hub links only the holder's own step (D-27). */
export const requestHolders = ['requestor', 'analyst', 'none'] as const;
export type RequestHolder = (typeof requestHolders)[number];
export type RequestLifecycleNextAction = { actor: 'requestor' | 'analyst' | 'none'; holder: RequestHolder; summary: string; href?: string };
export type RequestLifecycle = { currentKey: RequestLifecycleStepKey; currentLabel: string; terminal: boolean; nextAction: RequestLifecycleNextAction | null; steps: readonly RequestLifecycleStep[] };

export const requestSortValues = [
  'updatedAt:desc',
  'updatedAt:asc',
  'dueDate:asc',
  'dueDate:desc',
  'requestNumber:asc',
  'requestNumber:desc',
  'title:asc',
  'title:desc',
] as const;

export type RequestSort = (typeof requestSortValues)[number];

export interface RequestListQuery {
  q: string;
  status: RequestStatus | undefined;
  sort: RequestSort;
  page: number;
  pageSize: 10 | 20 | 50;
}

/*
 * The My requests notes filter's one value (D-24): the requests with notes new to the Requestor. A type only: this
 * module is in client chunks that every route loads, where a value export ships even when unused (route budget), so
 * the closed list the URL parser reads lives in request-schema.ts.
 */
export type MyRequestNotesFilter = 'unread';

/** GET /v1/my_requests: today's My requests controls plus who holds the request (D-34) and new notes (D-24). */
export interface MyRequestListQuery extends RequestListQuery {
  holder: RequestHolder | undefined;
  notes: MyRequestNotesFilter | undefined;
}

/**
 * One of the signed-in actor's own requests, read from the Requestor's side
 * (D-02 item 6). The server decides the holder, stage and next step; there is
 * deliberately no Risk Assessment field (T-11-53). The assignee is a display
 * name and nothing more (D-17); unreadNotes counts the notes new to the
 * Requestor (D-24).
 */
export interface MyRequestItem {
  documentId: string;
  requestNumber: string;
  title: string;
  requestStatus: RequestStatus;
  submittedDate: string | null;
  dueDate: string | null;
  updatedAt: string | null;
  daysSinceSubmission: number | null;
  holder: RequestHolder;
  stage: { key: RequestLifecycleStepKey; label: string };
  nextAction: { summary: string; href?: string } | null;
  returned: { reason: string | null; at: string } | null;
  questionnaire: { documentId: string; answered: number; total: number } | null;
  assignee: { displayName: string } | null;
  unreadNotes: number;
}

export interface MyRequestList {
  items: readonly MyRequestItem[];
  pagination: RequestPagination;
}

export interface RequestRelationSummary {
  documentId: string;
  name: string;
}

export interface RequestQuestionnaireSummary {
  documentId: string;
  title: string;
}

export type AssessmentStatus = 'draft' | 'in-review' | 'approved' | 'closed';

export interface RequestAssessmentSummary {
  documentId: string;
  assessmentStatus: AssessmentStatus;
}

export type RequestRelationUnavailable = { availability: 'unavailable' };
export type RequestRelationAbsent = { availability: 'absent' };
export type RequestQuestionnaireRelation =
  | { availability: 'available'; documentId: string; questionnaireNumber: string | null; title: string | null; state: string | null }
  | RequestRelationAbsent
  | RequestRelationUnavailable;
export type RequestAssessmentRelation =
  | { availability: 'available'; documentId: string; assessmentNumber: string | null; assessmentStatus: string | null; residualRiskCounts: Record<'Low' | 'Moderate' | 'High' | 'Critical' | 'total', number>; controlImplementationCount?: number }
  | RequestRelationAbsent
  | RequestRelationUnavailable;
export interface AssessmentRequestRelationships {
  questionnaire: RequestQuestionnaireRelation;
  assessment: RequestAssessmentRelation;
}

/** What the Requestor sees of a request's assignment (D-17): the assignee's display name, or nobody. */
export type RequestorAssignmentView = { assignee: { displayName: string } | null };

/**
 * Who holds the request, as the request read serves it to this viewer (D-09, D-16, D-17): the analyst view for a
 * human Security Analyst, and the assignee's display name alone for everyone else.
 */
export type RequestAssignmentView = RequestAssignment | RequestorAssignmentView;

/** Whether the viewer was served the analyst view, with its actions, history and ownRequest. */
export function isAnalystAssignmentView(view: RequestAssignmentView): view is RequestAssignment {
  return 'actions' in view;
}

export interface CsrmAssessmentRequest {
  documentId: string;
  requestNumber: string;
  title: string;
  description: string | null;
  assessmentType?: 'BAU' | 'Project' | 'Other' | null;
  division?: string | null;
  businessUnit?: string | null;
  businessPurpose?: string | null;
  businessCriticality?: 'Low' | 'Moderate' | 'High' | 'Critical' | null;
  thirdPartyInvolvement?: boolean;
  thirdPartyDetails?: string | null;
  regulatoryRequirements?: string | null;
  requestStatus: RequestStatus;
  submittedDate?: string | null;
  dueDate: string | null;
  updatedAt: string | null;
  dueDateLabel: string | null;
  updatedDateLabel: string | null;
  informationSystems: readonly RequestRelationSummary[];
  informationAssets: readonly RequestRelationSummary[];
  requestorName?: string | null;
  questionnaire: RequestQuestionnaireSummary | null;
  assessment: RequestAssessmentSummary | null;
  relationships?: AssessmentRequestRelationships;
  lifecycle?: RequestLifecycle;
  revertReason?: string | null;
  revertedAt?: string | null;
  revertedBy?: { documentId: string; displayName: string | null } | null;
  /** Who holds the request (Phase 13); null when the read did not carry it. */
  assignment?: RequestAssignmentView | null;
  /** The viewer's notes figures from the request read (Phase 13 D-24, D-25); null when Strapi serves none. */
  notes?: RequestNotesSummary | null;
  /** The analyst's AI-inputs signal per target (Phase 13 D-29); null for any other viewer. */
  aiInputs?: RequestAiInputs | null;
  /** The viewer's file summary (Phase 14 D-04 item 7); absent for anyone who may not read the request's files (D-18). */
  attachments?: RequestAttachmentSummary;
}

/**
 * A request's files as the viewer may act on them (Phase 14 D-04 item 7), decided by Strapi: how many it holds that are
 * not removed (the Files section's main list), whether the viewer may add one now and, if not, the closed reason,
 * whether a note is needed, the window, what remains of the limits, the limits and the allowed types.
 */
export type RequestAttachmentSummary = {
  count: number;
  canAdd: boolean;
  refusal: 'ATTACHMENTS_NOT_CONFIGURED' | 'ATTACHMENTS_CLOSED' | 'REQUEST_NOT_SUBMITTED' | 'ATTACHMENT_LIMIT_REACHED' | 'ATTACHMENT_LIFETIME_LIMIT_REACHED' | null;
  window: 'intake' | 'after-submission' | 'closed';
  needsNote: boolean;
  remaining: number;
  activeCount: number;
  storedCount: number;
  limits: { maxBytes: number; maxActive: number; maxStored: number };
  allowedTypes: readonly ('pdf' | 'docx' | 'xlsx' | 'pptx' | 'csv' | 'txt' | 'png' | 'jpeg')[];
};

/** Which notes changed each target's AI inputs since it was generated (D-29); a target is null with nothing to list. */
export type RequestAiInputs = { questionnaire: AiInputsChanged | null; assessment: AiInputsChanged | null };

/**
 * The request summary on the analyst questionnaire and assessment reads (Phase 13 D-16, D-25), server-rendered beside the
 * originating request link: who holds the request and whether the viewer may pick it up, and the notes figures. Null on
 * every other read, a Requestor's included.
 */
export type RequestSummaryAssignment = {
  assignee: { documentId: string; displayName: string } | null;
  pickUp: 'allowed' | 'own-request' | 'not-offered';
};
export type RequestSummaryNotes = { total: number; unread: number };
/** Phase 14 D-27: how many files the request holds (not removed), and how many of them are in the AI inputs. */
export type RequestSummaryFiles = { count: number; included: number };

/**
 * A request's notes as the viewer reads them (D-24, D-25), decided by Strapi: how many notes it holds, how many are new
 * to the viewer, and whether it takes a new note and, if not, why.
 */
export type RequestNotesSummary = {
  total: number;
  unread: number;
  accepting: boolean;
  closedReason: NotesClosedReason | null;
};

export function canRequestorEdit(status: RequestStatus): boolean {
  return status === 'draft';
}

/**
 * Whether a request may return to draft (D-22), mirroring the rule Strapi applies: it is submitted and
 * neither a questionnaire nor an assessment exists for it. It reads only the served relationships, where
 * `unavailable` still means one exists, never the legacy nullable fields. A request read without its
 * relationships fails closed. Both actors' pages use it to decide whether to offer the action; Strapi
 * still decides whether to perform it.
 */
export function canRevertRequestToDraft(request: Pick<CsrmAssessmentRequest, 'requestStatus' | 'relationships'>): boolean {
  const relationships = request.relationships;
  if (request.requestStatus !== 'submitted' || !relationships) return false;
  return relationships.questionnaire.availability === 'absent' && relationships.assessment.availability === 'absent';
}

export type QuestionnaireGenerationAction = 'generate' | 'replace' | 'released' | 'exists';

/**
 * Which generation action the analyst hub offers for a submitted request (D-08, D-09, D-22), read from the
 * served questionnaire relation alone. With no questionnaire the analyst generates one; a questionnaire still
 * in analyst review may be replaced. Any other questionnaire that exists is never offered for replacement,
 * because Strapi would refuse it: one served as released is `released`, and the card says how to replace it
 * (UI-SPEC §3.3); any other (submitted, not open to this analyst, or served without a state) is `exists`, and
 * the card says only that it exists, never more than the page knows (IN-201). Strapi still decides.
 */
export function questionnaireGenerationAction(relation: RequestQuestionnaireRelation): QuestionnaireGenerationAction {
  if (relation.availability === 'absent') return 'generate';
  if (relation.availability === 'available' && relation.state === 'analyst-review') return 'replace';
  return relation.availability === 'available' && relation.state === 'released' ? 'released' : 'exists';
}

/**
 * Whether the analyst's request page offers questionnaire generation (Generate or Replace, D-08, D-09):
 * Strapi generates a questionnaire only for a submitted request, so the page offers the card only then.
 */
export function offersQuestionnaireGeneration(request: Pick<CsrmAssessmentRequest, 'requestStatus'>): boolean {
  return request.requestStatus === 'submitted';
}

/**
 * The served lifecycle as the analyst's request page shows it (UX-06; walkthrough fix 4). Strapi derives the
 * lifecycle step from the request's relations alone, so a request past `submitted` that holds no questionnaire
 * still reads as the Submitted step, whose analyst action is "Generate the questionnaire.". The page offers
 * generation only on the fact Strapi's generation rule uses, so the Next action follows that same fact: on any
 * other request it names no action, never one the page does not offer. The steps are served unchanged.
 */
export function analystRequestLifecycle(request: Pick<CsrmAssessmentRequest, 'requestStatus' | 'lifecycle'>): RequestLifecycle | undefined {
  const lifecycle = request.lifecycle;
  if (!lifecycle?.nextAction) return lifecycle;
  const namesGeneration = lifecycle.currentKey === 'submitted' && lifecycle.nextAction.actor === 'analyst';
  return namesGeneration && !offersQuestionnaireGeneration(request) ? { ...lifecycle, nextAction: null } : lifecycle;
}

/** The next action as a page displays it: a sentence, and the destination it opens when it opens one. */
export type NextActionPresentation = { summary: string; href?: string };

/**
 * One presentation of the next action, read by the request hub and the lifecycle stepper alike, so both lines
 * read one source (D-27, D-28; UI-D23). The page's override, while a generation job is queued or running, replaces
 * the summary as plain text. Otherwise the served summary links only when the viewer holds the step and the server
 * supplied an href, decided from the served holder, never from the words.
 */
export function nextActionPresentation(nextAction: RequestLifecycleNextAction | null | undefined, override?: string): NextActionPresentation | null {
  if (override) return { summary: override };
  if (!nextAction) return null;
  return nextAction.holder === nextAction.actor && nextAction.href ? { summary: nextAction.summary, href: nextAction.href } : { summary: nextAction.summary };
}

/**
 * The holder line My requests shows above each next step (UI-SPEC §7.3, UI-D25): the Requestor Home's section
 * names, so one vocabulary runs from Home to the list.
 */
export const requestHolderPresentation = {
  requestor: { label: 'Needs your action' },
  analyst: { label: 'With the Security Analyst' },
  none: { label: 'No action needed' },
} satisfies Record<RequestHolder, { label: string }>;

/**
 * A my requests item's next step as the list shows it (D-34). The list is read from the Requestor's side, so the
 * viewer is the Requestor: the served sentence goes through the one next-action presentation, which links it only
 * when the Requestor holds the step and the server supplied an href. A closed request has no next step.
 */
export function myRequestNextStep(item: Pick<MyRequestItem, 'holder' | 'nextAction'>): NextActionPresentation | null {
  if (!item.nextAction) return null;
  return nextActionPresentation({ actor: 'requestor', holder: item.holder, ...item.nextAction });
}

/** A served instant a list can show, or null when it is missing or does not parse, so the list says so instead. */
export function shownInstant(value: string | null | undefined): string | null {
  return value && !Number.isNaN(new Date(value).getTime()) ? value : null;
}

export interface RequestPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export function formatRequestDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
