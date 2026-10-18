import { PageHeader } from '@/components/csrm/page-header';
import { QuestionnaireList } from '@/features/questionnaires/questionnaire-list';
import { pageHeadings } from '@/config/navigation/page-headings';

export default function QuestionnairesLoading() {
  return (
    <>
      <PageHeader
        title={pageHeadings.myQuestionnaires}
        description="Complete the questionnaires assigned to assessment requests you are authorised to view."
      />
      <QuestionnaireList questionnaires={[]} state="loading" />
    </>
  );
}
