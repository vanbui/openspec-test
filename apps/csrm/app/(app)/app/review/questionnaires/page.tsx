import { PageHeader } from '@/components/csrm/page-header';
import { QuestionnaireReviewList } from '@/features/questionnaires/questionnaire-review-list';
import { listQuestionnairesForReview, parseQuestionnaireListQuery } from '@/features/questionnaires/questionnaire-service';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

export const metadata = { title: 'Questionnaire Review | IdamBox CSRM' };

type QuestionnaireReviewsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function QuestionnaireReviewsPage({ searchParams }: QuestionnaireReviewsPageProps) {
  const params = await searchParams;
  const query = parseQuestionnaireListQuery(params);
  const result = await listQuestionnairesForReview(query);
  const state = result.error
    ? result.error.status === 403 ? 'permission' : 'error'
    : undefined;

  if (result.error) {
    return (
      <>
        <PageHeader title="Questionnaire Review" description="Review questionnaire submission status and authorised submitted responses." />
        <QuestionnaireReviewList pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} query={query} questionnaires={[]} state={state} />
      </>
    );
  }

  const fixtureState = resolveE2eUiState(params);
  if (fixtureState && fixtureState !== 'populated') {
    return (
      <>
        <PageHeader title="Questionnaire Review" description="Review questionnaire submission status and authorised submitted responses." />
        <E2eUiStateBoundary state={fixtureState}>
          <QuestionnaireReviewList pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} query={query} questionnaires={[]} state={fixtureState === 'empty' ? undefined : fixtureState} />
        </E2eUiStateBoundary>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Questionnaire Review" description="Review questionnaire submission status and authorised submitted responses." />
      {fixtureState ? <E2eUiStateBoundary state={fixtureState}><QuestionnaireReviewList pagination={result.data?.pagination} query={query} questionnaires={result.data?.questionnaires ?? []} state={state} /></E2eUiStateBoundary> : <QuestionnaireReviewList pagination={result.data?.pagination} query={query} questionnaires={result.data?.questionnaires ?? []} state={state} />}
    </>
  );
}
