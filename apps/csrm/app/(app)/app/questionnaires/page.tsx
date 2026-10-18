import { PageHeader } from '@/components/csrm/page-header';
import { exportMyQuestionnairesAction } from '@/features/exports/export-actions';
import { ListExportButton } from '@/features/exports/list-export-button';
import { questionnaireFilterChips } from '@/features/questionnaires/questionnaire-list-chips';
import { QuestionnaireList } from '@/features/questionnaires/questionnaire-list';
import { listMyQuestionnaires, parseQuestionnaireListQuery } from '@/features/questionnaires/questionnaire-service';
import { E2eUiStateBoundary, resolveE2eUiState } from '@/lib/testing/e2e-ui-state';
import { pageHeadings, routeTitle } from '@/config/navigation/page-headings';
import { can } from '@/lib/capabilities/capability-adapter';
import { viewerCapabilities } from '@/lib/capabilities/viewer-capabilities';

export const metadata = { title: routeTitle(pageHeadings.myQuestionnaires) };

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
  // Export (the Export placement pattern, the pilot's ruling of 2026-10-16) shows only when the read returned the
  // list, no E2E presentation fixture replaced it, and the session holds my-questionnaires:export (D-16).
  const exportButton = result.data && (!fixtureState || fixtureState === 'populated') && can('my-questionnaires:export', await viewerCapabilities())
    ? <ListExportButton action={exportMyQuestionnairesAction} chips={questionnaireFilterChips(query)} heading={pageHeadings.myQuestionnaires} pagination={result.data.pagination} query={query} view="my-questionnaires" />
    : undefined;

  return (
    <>
      <PageHeader
        action={exportButton}
        title={pageHeadings.myQuestionnaires}
        description="Complete the questionnaires assigned to assessment requests you are authorised to view."
      />
      {fixtureState ? <E2eUiStateBoundary state={fixtureState}>{list}</E2eUiStateBoundary> : list}
    </>
  );
}
