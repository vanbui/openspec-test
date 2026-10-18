import { PageHeader } from '@/components/csrm/page-header';
import { exportQuestionnairesAction } from '@/features/exports/export-actions';
import { ListExportButton } from '@/features/exports/list-export-button';
import { questionnaireFilterChips } from '@/features/questionnaires/questionnaire-list-chips';
import { QuestionnaireReviewList } from '@/features/questionnaires/questionnaire-review-list';
import { listQuestionnairesForReview, parseQuestionnaireListQuery } from '@/features/questionnaires/questionnaire-service';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';
import { pageHeadings, routeTitle } from '@/config/navigation/page-headings';
import { canViewerReviewAssessments } from '@/lib/capabilities/analyst-review-gate';
import { can } from '@/lib/capabilities/capability-adapter';
import { viewerCapabilities } from '@/lib/capabilities/viewer-capabilities';

export const metadata = { title: routeTitle(pageHeadings.reviewQuestionnaires) };

type QuestionnaireReviewsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const description = 'Review questionnaire submission status and authorised submitted responses.';

/*
 * The page renders its header and list together after the read. The header's Export (the Export placement pattern, the
 * pilot's ruling of 2026-10-16) shows only when the read returned the list, no E2E presentation fixture replaced it,
 * and the session holds questionnaires:export; the server refuses every other export (D-16).
 */
export default async function QuestionnaireReviewsPage({ searchParams }: QuestionnaireReviewsPageProps) {
  const params = await searchParams;
  const query = parseQuestionnaireListQuery(params);
  if (!(await canViewerReviewAssessments())) {
    return <><PageHeader title={pageHeadings.reviewQuestionnaires} description={description} /><QuestionnaireReviewList pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} query={query} questionnaires={[]} state="permission" /></>;
  }
  const result = await listQuestionnairesForReview(query);
  const state = result.error
    ? result.error.status === 403 ? 'permission' : 'error'
    : undefined;

  if (result.error) {
    return (
      <>
        <PageHeader title={pageHeadings.reviewQuestionnaires} description={description} />
        <QuestionnaireReviewList pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} query={query} questionnaires={[]} state={state} />
      </>
    );
  }

  const fixtureState = resolveE2eUiState(params);
  if (fixtureState && fixtureState !== 'populated') {
    return (
      <>
        <PageHeader title={pageHeadings.reviewQuestionnaires} description={description} />
        <E2eUiStateBoundary state={fixtureState}>
          <QuestionnaireReviewList pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} query={query} questionnaires={[]} state={fixtureState === 'empty' ? undefined : fixtureState} />
        </E2eUiStateBoundary>
      </>
    );
  }
  const exportButton = can('questionnaires:export', await viewerCapabilities())
    ? <ListExportButton action={exportQuestionnairesAction} chips={questionnaireFilterChips(query)} heading={pageHeadings.reviewQuestionnaires} pagination={result.data.pagination} query={query} view="questionnaires" />
    : undefined;
  const list = <QuestionnaireReviewList pagination={result.data.pagination} query={query} questionnaires={result.data.questionnaires} state={state} />;
  return (
    <>
      <PageHeader action={exportButton} title={pageHeadings.reviewQuestionnaires} description={description} />
      {fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list}
    </>
  );
}
