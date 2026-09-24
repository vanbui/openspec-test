import { PageHeader } from '@/components/csrm/page-header';
import { QuestionnaireList } from '@/features/questionnaires/questionnaire-list';
import { listMyQuestionnaires, parseQuestionnaireListQuery } from '@/features/questionnaires/questionnaire-service';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';

export const metadata = { title: 'My Questionnaires | IdamBox CSRM' };

type QuestionnairesPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function QuestionnairesPage({ searchParams }: QuestionnairesPageProps) {
  const params = await searchParams;
  const query = parseQuestionnaireListQuery(params);
  const result = await listMyQuestionnaires(query);
  const fixtureState = result.error ? undefined : resolveE2eUiState(params);
  const state = result.error
    ? result.error.status === 403 ? 'permission' : 'error'
    : fixtureState === 'populated' || fixtureState === 'empty' ? undefined : fixtureState;
  const questionnaires = fixtureState && fixtureState !== 'populated' ? [] : result.data?.questionnaires ?? [];
  const pagination = fixtureState && fixtureState !== 'populated'
    ? { page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }
    : result.data?.pagination;
  const list = <QuestionnaireList pagination={pagination} query={query} questionnaires={questionnaires} state={state} />;

  return (
    <>
      <PageHeader
        title="My Questionnaires"
        description="Complete the questionnaires assigned to assessment requests you are authorised to view."
      />
      {fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list}
    </>
  );
}
