import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { PageHeader } from '@/components/csrm/page-header';
import { StatusBadge } from '@/components/csrm/status-badge';
import { ErrorState } from '@/components/states/states';
import { listRequestAttachments } from '@/features/attachments/attachments-service';
import { FilesSection, filesSectionFor, noteFilesFor } from '@/features/attachments/files-section';
import { RequestWorkflowActions } from '@/features/requests/request-workflow-actions';
import { RequestContextDetails } from '@/features/requests/request-context-details';
import { getRequest } from '@/features/requests/request-service';
import { RequestLifecycleStepper } from '@/features/requests/request-lifecycle-stepper';
import { RequestHub } from '@/features/requests/request-hub';
import { NotesSection, notesAuthorNames } from '@/features/request-notes/notes-section';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';
import { draftOwnerKey } from '@/lib/session-drafts/draft-owner-key';

type RequestDetailPageProps = { params: Promise<{ documentId: string }> };

// One read per request, shared by the document title and the page.
const readRequest = cache(getRequest);

export async function generateMetadata({ params }: RequestDetailPageProps): Promise<Metadata> {
  return recordRouteMetadata(readRequest((await params).documentId), 'Assessment Request | IdamBox CSRM', { refusedAsMissing: true });
}

/*
 * A request that fails to load keeps the page's one level-one heading. It names the page, never the record.
 */
function UnavailableRequestHeader() {
  return <PageHeader description="Track the lifecycle and linked records of an assessment request." title="Assessment request" />;
}

export default async function RequestDetailPage({ params }: RequestDetailPageProps) {
  const { documentId } = await params;
  const result = await readRequest(documentId);
  /*
   * 13-UI-SPEC §8.6 (D-23; O1 of the 13-19 walk): a request Strapi refuses this viewer, another Requestor's, is the page's
   * own not-found state, exactly as a missing one, so nothing says it exists and no notes surface, count or flag renders.
   * Strapi still answers that read with 403; Phase 17 (G-12, ASSESS-22) unifies the API's refusal.
   */
  if (result.error?.status === 404 || result.error?.status === 403) notFound();
  if (result.error) return <><UnavailableRequestHeader /><ErrorState /></>;
  if (!result.data) notFound();
  const request = result.data;
  const sessionAdapter = getSessionAdapter();
  const [session, files] = await Promise.all([
    sessionAdapter.current(),
    /* D-18: only a viewer the read gave a file summary may read the files; nothing is read for anyone else. */
    request.attachments ? listRequestAttachments(request.documentId) : Promise.resolve(null),
  ]);
  const ownerKey = session ? draftOwnerKey(session) : null;
  const filesSection = filesSectionFor(request, files, { viewer: 'requestor', draftOwnerKey: ownerKey });
  /* 14-UI-SPEC §4 (D-17, D-27): each note's files from the same list, and whether the composer takes files. */
  const noteFiles = noteFilesFor(filesSection);
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  const relationships = request.relationships;
  const questionnaireHref = relationships?.questionnaire.availability === 'available' && can('assessment-request:read', granted)
    ? `/app/questionnaires/${encodeURIComponent(relationships.questionnaire.documentId)}` : undefined;
  const assessmentHref = relationships?.assessment.availability === 'available' && can('assessment-request:read', granted)
    ? `/app/assessments/${encodeURIComponent(relationships.assessment.documentId)}` : undefined;

  return (
    <>
      <PageHeader description={request.requestNumber} status={<StatusBadge status={request.requestStatus} />} title={request.title} />
      <div className="grid gap-6">
        <RequestLifecycleStepper lifecycle={request.lifecycle} />
        <RequestHub hrefs={{ questionnaire: questionnaireHref, assessment: assessmentHref }} lifecycle={request.lifecycle} request={request} />
        {/*
          * The hub is a compact operational summary, not a replacement for the
          * record. A Requestor must still be able to read back the business
          * context they submitted, and the revert audit that Phase 06.1
          * delivered, from the request they own. The analyst reads the same component.
          */}
        <RequestContextDetails request={request} />
        <section aria-label="Request actions" className="rounded-lg border border-border p-6" id="request-actions" tabIndex={-1}>
          {/* §2.4 (UI-D5): the submit dialog waits for the draft's files on their way, from the tab's file store. */}
          <RequestWorkflowActions draftOwnerKey={ownerKey} request={request} />
        </section>
        {/*
          * 14-UI-SPEC §3 (UI-D2): Files sits directly before Notes, and nothing renders for a viewer the read gave no file
          * summary (D-18). A failed files read keeps the section with its compact error.
          */}
        {filesSection ? <FilesSection {...filesSection} /> : null}
        {/*
          * 13-UI-SPEC §8 (UI-D13): the last section; nothing renders for a viewer the read gave no notes summary (D-23).
          * §9.3 (UI-D17): unsent note text is kept per person and request; the key names nobody in clear.
          */}
        {request.notes ? <NotesSection attach={noteFiles.attach} authorNames={notesAuthorNames(request)} draftOwnerKey={ownerKey} filesByNote={noteFiles.byNote} requestId={request.documentId} requestNumber={request.requestNumber} summary={request.notes} viewer="requestor" /> : null}
      </div>
    </>
  );
}
