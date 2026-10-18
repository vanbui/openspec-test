'use server';

import { z } from 'zod';

import { deriveQuestionnaireStatus, statusLabel } from '@/components/csrm/status-badge';
import type { TransportResult } from '@/lib/api/transport/server-client';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can } from '@/lib/capabilities/capability-adapter';
import type { AssessmentSummary } from '../assessments/assessment-schema';
import { listAnalystAssessments, listAssessmentRequests, listMyReleasedAssessments } from '../assessments/assessment-service';
import type { QuestionnaireSummary } from '../questionnaires/questionnaire-service';
import { listMyQuestionnaires, listQuestionnairesForReview } from '../questionnaires/questionnaire-service';
import { listMyRequests } from '../requests/request-service';
import { riskRegisterStageLabels } from '../risks/risk-domain';
import { parseRiskRegisterQuery } from '../risks/risk-schema';
import { listRiskRegister } from '../risks/risk-service';
import {
  QUICK_FIND_GROUP_SIZE,
  quickFindGroupLabels,
  quickFindGroupsFor,
  quickFindRequestLine,
  quickFindShowAllHref,
  type QuickFindGroup,
  type QuickFindGroupKind,
  type QuickFindOption,
  type QuickFindResult,
} from './quick-find-domain';

/*
 * Quick find's one Server Action (UX-10; D-49; UI-SPEC §4.2). An action is a public POST, so the term is validated
 * before anything is read and the viewer is the session's. The viewer's capabilities choose which existing list
 * searches run, in parallel, through the existing feature service functions (so no new module calls the client and
 * served-operations.json is unchanged); Strapi scopes every read, so a result is only ever a record the viewer may
 * read. What leaves the server is display fields and hrefs, never records.
 *
 * It never revalidates, sets a cookie or refreshes (research Pitfall 17): a search changes nothing.
 */

/* QUICK_FIND_MIN_TERM_LENGTH and QUICK_FIND_MAX_TERM_LENGTH, written out so the bound reads at the boundary. */
const quickFindInputSchema = z.object({
  term: z.string().trim().min(2).max(100),
}).strict();

export type QuickFindActionResult = { ok: true; data: QuickFindResult } | { ok: false; formError: string };

/** One list's first page, reduced to what the dialog shows. */
type GroupPage = { total: number; options: readonly QuickFindOption[] };

/* Each list is read at page 1 with page size 10, the smallest size every list accepts; the first five are shown. */
const firstPage = { page: 1, pageSize: 10 } as const;

function pageOf<T>(result: TransportResult<T>, toPage: (data: T) => GroupPage): TransportResult<GroupPage> {
  return result.error === null ? { data: toPage(result.data), error: null } : result;
}

const recordHref = (path: string, documentId: string) => `${path}/${encodeURIComponent(documentId)}`;
const named = (identifier: string, name: string | null | undefined) => (name ? `${identifier} · ${name}` : identifier);

/* The assessment lists take one closed query; only the term differs. */
const assessmentQuery = (term: string) => ({
  q: term, status: undefined, overallRating: undefined, approvedFrom: undefined, approvedTo: undefined, sort: 'generatedDate:desc' as const, ...firstPage,
});

function questionnairePage(path: string) {
  return ({ questionnaires, pagination }: { questionnaires: readonly QuestionnaireSummary[]; pagination: { total: number } }): GroupPage => ({
    total: pagination.total,
    options: questionnaires.map((questionnaire) => ({
      id: questionnaire.documentId,
      href: recordHref(path, questionnaire.documentId),
      primary: named(questionnaire.questionnaireNumber, questionnaire.title),
      // An unreleased questionnaire reads Analyst review on the analyst's side (the one status mapping).
      secondary: statusLabel('questionnaire', deriveQuestionnaireStatus(questionnaire.state, questionnaire.release)),
    })),
  });
}

function assessmentPage(path: string) {
  return ({ records, pagination }: { records: readonly AssessmentSummary[]; pagination: { total: number } }): GroupPage => ({
    total: pagination.total,
    options: records.map((assessment) => ({
      id: assessment.documentId,
      href: recordHref(path, assessment.documentId),
      primary: named(assessment.assessmentNumber, assessment.requestTitle),
      secondary: statusLabel('assessment', assessment.assessmentStatus),
    })),
  });
}

/*
 * One reader per list (D-49, UI-SPEC §4.3), each the list's own search through its existing service function, at
 * page 1 with page size 10. Each option is the record's identifier and name, its status label (Released for an
 * approved request or assessment), and the route its group opens.
 */
const readers: Readonly<Record<QuickFindGroupKind, (term: string) => Promise<TransportResult<GroupPage>>>> = {
  // Every request in review scope: the All requests queue, so a request is found wherever it waits (D-30).
  'review-requests': async (term) => pageOf(
    await listAssessmentRequests({ q: term, queue: 'all', status: undefined, sort: 'submittedDate:desc', ...firstPage }),
    ({ records, pagination }) => ({
      total: pagination.total,
      options: records.map((request) => ({
        id: request.documentId,
        href: recordHref('/app/review/requests', request.documentId),
        primary: named(request.requestNumber, request.title),
        // D-13: who holds it, from the same queue read; no read of its own.
        secondary: quickFindRequestLine(statusLabel('request', request.requestStatus), request.assignee),
      })),
    }),
  ),
  'review-questionnaires': async (term) => pageOf(
    await listQuestionnairesForReview({ q: term, sort: 'updatedAt:desc', ...firstPage }),
    questionnairePage('/app/review/questionnaires'),
  ),
  'review-assessments': async (term) => pageOf(await listAnalystAssessments(assessmentQuery(term)), assessmentPage('/app/review/assessments')),
  // The register allows only 10, 25 or 50 a page; Strapi applies the analyst's register scope.
  risks: async (term) => pageOf(
    await listRiskRegister(parseRiskRegisterQuery({ q: term, page: 1, pageSize: 10 })),
    ({ data, meta }) => ({
      total: meta.pagination.total,
      options: data.map((risk) => ({
        id: risk.documentId,
        href: recordHref('/app/risks', risk.documentId),
        primary: named(risk.riskNumber, risk.riskStatement),
        secondary: `Residual rating: ${risk.residualRating ?? 'Not rated'} · ${riskRegisterStageLabels[risk.stage]}`,
      })),
    }),
  ),
  'my-requests': async (term) => pageOf(
    await listMyRequests({ q: term, status: undefined, holder: undefined, notes: undefined, sort: 'updatedAt:desc', ...firstPage }),
    ({ items, pagination }) => ({
      total: pagination.total,
      options: items.map((item) => ({
        id: item.documentId,
        href: recordHref('/app/requests', item.documentId),
        primary: named(item.requestNumber, item.title),
        secondary: statusLabel('request', item.requestStatus),
      })),
    }),
  ),
  'my-questionnaires': async (term) => pageOf(
    await listMyQuestionnaires({ q: term, sort: 'updatedAt:desc', ...firstPage }),
    questionnairePage('/app/questionnaires'),
  ),
  'my-assessments': async (term) => pageOf(await listMyReleasedAssessments(assessmentQuery(term)), assessmentPage('/app/assessments')),
};

/*
 * One list's group, or null when Strapi refuses it (a list the viewer cannot read is not shown).
 * Successful empty lists remain in the outcome so a partial failure cannot become an all-list outage.
 * A failed or thrown read marks only its own group failed, with no detail of the failure, so the others still show.
 */
async function searchGroup(kind: QuickFindGroupKind, term: string): Promise<QuickFindGroup | null> {
  const label = quickFindGroupLabels[kind];
  const failed: QuickFindGroup = { kind, label, total: 0, status: 'failed', options: [] };
  try {
    const result = await readers[kind](term);
    if (result.error !== null) return result.error.status === 403 ? null : failed;
    const { total, options } = result.data;
    return {
      kind,
      label,
      total,
      status: 'ok',
      options: options.slice(0, QUICK_FIND_GROUP_SIZE),
      ...(total > QUICK_FIND_GROUP_SIZE ? { showAllHref: quickFindShowAllHref(kind, term) } : {}),
    };
  } catch {
    return failed;
  }
}

export async function quickFindAction(input: unknown): Promise<QuickFindActionResult> {
  const parsed = quickFindInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, formError: 'Type 2 or more characters of a number or title.' };
  const { term } = parsed.data;

  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  if (!session) return { ok: false, formError: 'Search isn’t available right now.' };
  const granted = await sessionAdapter.capabilitiesFor(session).granted();
  if (!can('assessment-request:read', granted)) return { ok: false, formError: 'Search isn’t available right now.' };

  // Every allowed list starts at once (Server Actions run one at a time per client, so the parallelism lives here).
  // The Risk register is asked only with risk:manage, checked again where the reads start.
  const kinds = quickFindGroupsFor(granted).filter((kind) => kind !== 'risks' || can('risk:manage', granted));
  const groups = await Promise.all(kinds.map((kind) => searchGroup(kind, term)));
  return { ok: true, data: { term, groups: groups.filter((group): group is QuickFindGroup => group !== null) } };
}
