import { FilesSkeleton } from '@/features/attachments/files-skeleton';
import { AssessmentDetailSkeleton } from '@/features/assessments/assessment-detail';
import { NotesSkeleton } from '@/features/request-notes/notes-skeleton';

export default function AssessmentRequestReviewLoading() {
  /* 13-UI-SPEC §8.6, 14-UI-SPEC §3.7: Files sits directly before Notes, which closes the page, as their blocks do here. */
  return (
    <>
      <AssessmentDetailSkeleton />
      <div className="mt-6"><FilesSkeleton /></div>
      <div className="mt-6"><NotesSkeleton /></div>
    </>
  );
}
