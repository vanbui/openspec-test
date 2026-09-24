import { PageHeader } from '@/components/csrm/page-header';
import { QuestionnaireList } from '@/features/questionnaires/questionnaire-list';

export default function QuestionnairesLoading() {
  return (
    <>
      <PageHeader
        title="My Questionnaires"
        description="Complete the questionnaires assigned to assessment requests you are authorised to view."
      />
      <QuestionnaireList questionnaires={[]} state="loading" />
    </>
  );
}
