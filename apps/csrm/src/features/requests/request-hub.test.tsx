import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TimeZoneProvider } from '@/components/csrm/local-time';

import type { CsrmAssessmentRequest, RequestLifecycle } from './request-domain';
import { nextActionPresentation, requestLifecycleStepKeys } from './request-domain';
import { RequestHub } from './request-hub';

const lifecycle: RequestLifecycle = {
  currentKey: 'questionnaire-released', currentLabel: 'Questionnaire released', terminal: false,
  nextAction: { actor: 'requestor', holder: 'requestor', summary: 'Answer and submit the questionnaire.', href: '/app/questionnaires/q-1' },
  steps: requestLifecycleStepKeys.map((key, index) => ({ key, label: key, state: index < 3 ? 'completed' : index === 3 ? 'current' : 'future' })),
};

function request(overrides: Partial<CsrmAssessmentRequest> = {}): CsrmAssessmentRequest {
  return {
    documentId: 'request-1', requestNumber: 'RAR-001', title: 'Portal assessment', description: null,
    assessmentType: 'Project', businessCriticality: 'High', requestStatus: 'questionnaire-in-progress',
    submittedDate: '2026-09-01T00:00:00.000Z', dueDate: '2026-10-01', updatedAt: null,
    dueDateLabel: '1 Oct 2026', updatedDateLabel: null, requestorName: 'Jane Doe',
    informationSystems: [{ documentId: 'system-1', name: 'Customer portal' }],
    informationAssets: [{ documentId: 'asset-1', name: 'Customer data' }], questionnaire: null, assessment: null,
    relationships: {
      questionnaire: { availability: 'available', documentId: 'q-1', questionnaireNumber: 'QUES-001', title: 'Portal questionnaire', state: 'released' },
      assessment: { availability: 'available', documentId: 'a-1', assessmentNumber: 'ASM-001', assessmentStatus: 'in-review', controlImplementationCount: 3, residualRiskCounts: { Low: 1, Moderate: 2, High: 3, Critical: 4, total: 10 } },
    },
    ...overrides,
  };
}

const hrefs = { questionnaire: '/app/questionnaires/q-1', assessment: '/app/assessments/a-1' };

/*
 * One presentation of the next action, read by the hub and the stepper alike (D-27, D-28): the page's override
 * as plain text when there is one; otherwise the served summary, with its href only for the viewer who holds
 * the step.
 */
describe('nextActionPresentation', () => {
  it('links the served summary only for the viewer who holds the step, and only with an href', () => {
    expect(nextActionPresentation).toBeTypeOf('function');
    expect(nextActionPresentation({ actor: 'analyst', holder: 'analyst', summary: 'Generate the questionnaire.', href: '/app/review/requests/request-1' }))
      .toEqual({ summary: 'Generate the questionnaire.', href: '/app/review/requests/request-1' });
    expect(nextActionPresentation({ actor: 'requestor', holder: 'analyst', summary: 'The Security Analyst is reviewing your request and will send you a questionnaire to answer.', href: '/app/requests/request-1' }))
      .toEqual({ summary: 'The Security Analyst is reviewing your request and will send you a questionnaire to answer.' });
    expect(nextActionPresentation({ actor: 'requestor', holder: 'requestor', summary: 'Answer and submit the questionnaire.' }))
      .toEqual({ summary: 'Answer and submit the questionnaire.' });
    expect(nextActionPresentation({ actor: 'requestor', holder: 'none', summary: 'No action is required.' }))
      .toEqual({ summary: 'No action is required.' });
  });

  it('reads the override as plain text in place of the summary, and nothing when there is neither', () => {
    expect(nextActionPresentation).toBeTypeOf('function');
    expect(nextActionPresentation({ actor: 'analyst', holder: 'analyst', summary: 'Generate the questionnaire.', href: '/app/review/requests/request-1' }, 'Questionnaire generation is in progress. Review the questionnaire when it’s ready.'))
      .toEqual({ summary: 'Questionnaire generation is in progress. Review the questionnaire when it’s ready.' });
    expect(nextActionPresentation(null, 'Assessment draft generation is in progress. Open the draft when it’s ready.'))
      .toEqual({ summary: 'Assessment draft generation is in progress. Open the draft when it’s ready.' });
    expect(nextActionPresentation(null)).toBeNull();
  });
});

describe('RequestHub', () => {
  /* UI-D23: below 768px the stepper's compact line is the one next action, so the hub's line shows from 768px only. */
  it('displays its next action line from 768px only, the override included', () => {
    const line = () => within(screen.getByRole('region', { name: 'Request summary' })).getByText('Next action:').closest('p') as HTMLElement;
    const view = render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request()} />);
    expect(line()).toHaveClass('hidden', 'md:block');
    view.rerender(<RequestHub hrefs={hrefs} lifecycle={lifecycle} nextActionOverride="Questionnaire generation is in progress. Review the questionnaire when it’s ready." request={request()} />);
    expect(line()).toHaveClass('hidden', 'md:block');
  });

  it('reads a next-action override as plain text after the unchanged prefix (UI-SPEC §12.3)', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} nextActionOverride="Questionnaire generation is in progress. Review the questionnaire when it’s ready." request={request()} />);

    const line = screen.getByText('Next action:').closest('p') as HTMLElement;
    expect(line).toHaveTextContent('Next action: Questionnaire generation is in progress. Review the questionnaire when it’s ready.');
    expect(within(line).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Answer and submit the questionnaire.' })).not.toBeInTheDocument();
  });

  it('links the next action only when the viewer holds the step and the server supplies an href (D-27)', () => {
    const nextActionLine = () => screen.getByText('Next action:').closest('p') as HTMLElement;
    const view = render(<RequestHub hrefs={hrefs} lifecycle={{ ...lifecycle, currentKey: 'submitted', nextAction: { actor: 'analyst', holder: 'analyst', summary: 'Generate the questionnaire.', href: '/app/review/requests/request-1' } }} request={request()} />);
    expect(within(nextActionLine()).getByRole('link', { name: 'Generate the questionnaire.' })).toHaveAttribute('href', '/app/review/requests/request-1');

    // The viewer does not hold the step: plain text, even if an href arrived, decided from holder and never from the words.
    view.rerender(<RequestHub hrefs={hrefs} lifecycle={{ ...lifecycle, currentKey: 'submitted', nextAction: { actor: 'requestor', holder: 'analyst', summary: 'The Security Analyst is reviewing your request and will send you a questionnaire to answer.', href: '/app/requests/request-1' } }} request={request()} />);
    expect(nextActionLine()).toHaveTextContent('Next action: The Security Analyst is reviewing your request and will send you a questionnaire to answer.');
    expect(within(nextActionLine()).queryByRole('link')).not.toBeInTheDocument();

    // The viewer holds the step but the server supplied no href: plain text.
    view.rerender(<RequestHub hrefs={{}} lifecycle={{ ...lifecycle, nextAction: { actor: 'requestor', holder: 'requestor', summary: 'Answer and submit the questionnaire.' } }} request={request()} />);
    expect(nextActionLine()).toHaveTextContent('Next action: Answer and submit the questionnaire.');
    expect(within(nextActionLine()).queryByRole('link')).not.toBeInTheDocument();

    // A released assessment is held by no one: No action is required. reads as plain text.
    view.rerender(<RequestHub hrefs={hrefs} lifecycle={{ ...lifecycle, currentKey: 'assessment-released', nextAction: { actor: 'requestor', holder: 'none', summary: 'No action is required.' } }} request={request()} />);
    expect(nextActionLine()).toHaveTextContent('Next action: No action is required.');
    expect(within(nextActionLine()).queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders all six available summaries with only the supplied record destinations', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request()} />);
    expect(screen.getByText('Next action:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Answer and submit the questionnaire.' })).toHaveAttribute('href', '/app/questionnaires/q-1');
    for (const [heading, text] of [['Questionnaire', 'QUES-001'], ['Assessment', 'ASM-001'], ['Risks', 'High: 3'], ['Controls', '3 control implementations.'], ['Information systems', 'Customer portal'], ['Information assets', 'Customer data']] as const) {
      expect(within(screen.getByRole('heading', { name: heading }).closest('article')!).getByText(text)).toBeInTheDocument();
    }
    // A record opens from its identifier, never from a separate Open control.
    expect(screen.getByRole('link', { name: 'QUES-001' })).toHaveAttribute('href', '/app/questionnaires/q-1');
    expect(screen.getByRole('link', { name: 'ASM-001' })).toHaveAttribute('href', '/app/assessments/a-1');
    expect(screen.queryByRole('link', { name: /^Open (questionnaire|assessment)$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open identified risks' })).toHaveAttribute('href', '/app/assessments/a-1');
    expect(screen.getByRole('link', { name: 'Open controls' })).toHaveAttribute('href', '/app/assessments/a-1');
    // The tally names what it counts and labels every rating, zeros included.
    expect(screen.getByText('Risks by residual rating.')).toBeInTheDocument();
    const counts = { Low: 1, Moderate: 2, High: 3, Critical: 4 } as const;
    for (const rating of ['Low', 'Moderate', 'High', 'Critical'] as const) {
      expect(screen.getByText(new RegExp(`^${rating}:`))).toBeInTheDocument();
      expect(screen.getByLabelText(`${rating} residual Risks: ${counts[rating]}`)).toBeInTheDocument();
    }
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('describes the summary in plain words and joins the number and title with a middle dot (D-38, D-43)', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request()} />);
    const summary = screen.getByRole('region', { name: 'Request summary' });
    expect(summary).toHaveAccessibleDescription('Where this request stands and what happens next.');
    expect(screen.getByText('Request').nextElementSibling?.textContent).toBe('RAR-001 · Portal assessment');
  });

  it('shows the submitted date as the viewer’s local date with no zone label, and the due date as chosen', () => {
    render(
      <TimeZoneProvider zone="Australia/Brisbane">
        <RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ submittedDate: '2026-09-27T20:00:00.000Z' })} />
      </TimeZoneProvider>,
    );
    // 20:00 UTC on 27 September is the morning of 28 September in Brisbane.
    expect(screen.getByText('Submitted date').nextElementSibling?.textContent).toBe('28 Sept 2026');
    expect(screen.getByText('Due date').nextElementSibling?.textContent).toBe('1 Oct 2026');
  });

  it('labels the assessment tile status from the shared mapping, so a released assessment reads Released', () => {
    const view = render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request()} />);
    expect(screen.getByText('Status: In review.')).toBeInTheDocument();

    const released = request();
    const relationships = released.relationships!;
    view.rerender(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={{ ...released, relationships: { ...relationships, assessment: { ...relationships.assessment, assessmentStatus: 'approved' } as typeof relationships.assessment } }} />);
    expect(screen.getByText('Status: Released.')).toBeInTheDocument();
    expect(screen.queryByText(/Approved/)).not.toBeInTheDocument();
  });

  it('states absent records and entirely omits unavailable records', () => {
    const absent = request({ relationships: { questionnaire: { availability: 'absent' }, assessment: { availability: 'absent' } }, informationSystems: [], informationAssets: [] });
    const view = render(<RequestHub hrefs={{}} lifecycle={lifecycle} request={absent} />);
    // An absent record contributes no identifier and no destination.
    expect(screen.queryByRole('link', { name: /^(QUES|ASM)-/ })).not.toBeInTheDocument();
    expect(screen.getByText('No questionnaire is linked to this request.')).toBeInTheDocument();
    expect(screen.getByText('No assessment exists for this request.')).toBeInTheDocument();
    expect(screen.getByText('No information systems are selected.')).toBeInTheDocument();
    expect(screen.getByText('No information assets are selected.')).toBeInTheDocument();
    view.rerender(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ relationships: { questionnaire: { availability: 'unavailable' }, assessment: { availability: 'unavailable' } } })} />);
    for (const heading of ['Questionnaire', 'Assessment', 'Risks', 'Controls']) expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument();
    // An unavailable record leaves no trace at all, because its existence is
    // itself protected: no identifier, linked or otherwise.
    expect(view.container.textContent).not.toMatch(/QUES-001|ASM-001/);
  });

  it('adds only governance wording for the analyst view and does not infer an action link', () => {
    const view = render(<RequestHub hrefs={hrefs} lifecycle={{ ...lifecycle, nextAction: { actor: 'analyst', holder: 'requestor', summary: 'The Requestor is answering the questionnaire.' } }} request={request()} />);
    expect(screen.getByText('Questionnaire state: released.')).toBeInTheDocument();
    const line = screen.getByText('Next action:').closest('p') as HTMLElement;
    expect(line).toHaveTextContent('Next action: The Requestor is answering the questionnaire.');
    expect(within(line).queryByRole('link')).not.toBeInTheDocument();
    view.rerender(<RequestHub governanceDetail hrefs={hrefs} lifecycle={lifecycle} request={request()} />);
    expect(screen.getByText('Governance state: released.')).toBeInTheDocument();
    expect(screen.queryByText('Questionnaire state: released.')).not.toBeInTheDocument();
  });
});

/*
 * 13-UI-SPEC §5.1 and §16 U3, changed deliberately by 13-09: the row Phase 10 named `Owner` reads `Requestor`, and
 * the row after it names who holds the request: `Assigned to` for an analyst (D-16), `Security Analyst` for the
 * Requestor (D-17), each in the actor's own words when nobody does.
 */
describe('RequestHub’s people rows (D-16, D-17; UI-D24)', () => {
  const bob = { documentId: 'u1', displayName: 'Bob Doe' };
  const analystView = { assignee: bob, assignedBy: bob, assignedAt: '2026-10-09T01:02:03.000Z', actions: ['reassign', 'unassign'] as const, ownRequest: false, history: [], viewer: bob };

  function row(term: string): HTMLElement {
    const label = screen.getByText(term, { selector: 'dt' });
    return label.parentElement as HTMLElement;
  }

  it('names the Requestor, and for an analyst who holds the request', () => {
    const view = render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ assignment: { ...analystView, actions: [...analystView.actions] } })} />);
    expect(row('Requestor')).toHaveTextContent('RequestorJane Doe');
    expect(row('Assigned to')).toHaveTextContent('Assigned toBob Doe');
    expect(screen.queryByText('Security Analyst', { selector: 'dt' })).not.toBeInTheDocument();
    view.rerender(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ assignment: { ...analystView, assignee: null, assignedBy: null, assignedAt: null, actions: ['pick-up', 'assign'] } })} />);
    expect(row('Assigned to')).toHaveTextContent('Assigned toNot picked up');
  });

  it('tells the Requestor which Security Analyst holds the request, or that nobody has picked it up yet', () => {
    const view = render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ assignment: { assignee: { displayName: 'Bob Doe' } } })} />);
    expect(row('Requestor')).toHaveTextContent('RequestorJane Doe');
    expect(row('Security Analyst')).toHaveTextContent('Security AnalystBob Doe');
    expect(screen.queryByText('Assigned to', { selector: 'dt' })).not.toBeInTheDocument();
    view.rerender(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ assignment: { assignee: null } })} />);
    expect(row('Security Analyst')).toHaveTextContent('Security AnalystNot picked up yet');
  });

  /*
   * UI-05 (13-UI-SPEC Typography level 4, amended 2026-10-10): every term in the hub's Request summary is a micro-label
   * in the secondary text colour, as the Request context section below it is, the terms that predate Phase 13 included.
   */
  it('sets every summary term as a secondary micro-label, words unchanged, on both pages', () => {
    const notes = { total: 2, unread: 1, accepting: true, closedReason: null };
    const terms = (container: HTMLElement) => [...container.querySelector('dl')!.querySelectorAll(':scope > div > dt')] as HTMLElement[];
    const expectMicroLabels = (container: HTMLElement, words: string[]) => {
      const found = terms(container);
      expect(found.map((term) => term.textContent)).toEqual(words);
      for (const term of found) {
        expect(term).toHaveClass('micro-label', 'text-foreground-secondary');
        for (const handBuilt of ['uppercase', 'tracking-wide', 'font-medium', 'text-xs', 'text-muted-foreground']) expect(term).not.toHaveClass(handBuilt);
      }
    };
    const analyst = render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ notes, assignment: { ...analystView, actions: [...analystView.actions] } })} />);
    expectMicroLabels(analyst.container, ['Request', 'Assessment type', 'Business criticality', 'Due date', 'Submitted date', 'Requestor', 'Assigned to', 'Notes']);
    analyst.unmount();
    const requestor = render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ notes, assignment: { assignee: { displayName: 'Bob Doe' } } })} />);
    expectMicroLabels(requestor.container, ['Request', 'Assessment type', 'Business criticality', 'Due date', 'Submitted date', 'Requestor', 'Security Analyst', 'Notes']);
  });

  it('keeps no Owner term, and adds no holder row when the read carries no assignment', () => {
    const view = render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request()} />);
    expect(screen.queryByText('Owner')).not.toBeInTheDocument();
    expect(row('Requestor')).toHaveTextContent('Jane Doe');
    expect(view.container.querySelector('dl')?.querySelectorAll('dt')).toHaveLength(6);
  });
});

/*
 * 13-UI-SPEC §5.1 (D-25; X-10, X-17): the hub's Notes row is a figure that opens the thread, says how many notes are new
 * to the viewer, invites the first note while the window is open, and says No notes when it is not. A read that carries
 * no notes summary (a participant's, Phase 17) adds no row.
 */
describe('RequestHub’s Notes row (13-UI-SPEC §5.1)', () => {
  function notesRow(): HTMLElement {
    return screen.getByText('Notes', { selector: 'dt' }).parentElement as HTMLElement;
  }

  it('links the figure to the thread, named with its count and the new ones', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ notes: { total: 2, unread: 1, accepting: true, closedReason: null } })} />);
    const link = within(notesRow()).getByRole('link', { name: '2 notes, 1 new' });
    expect(link).toHaveAttribute('href', '#notes');
    expect(link.textContent).toBe('2 notes1 new');
  });

  it('reads one note without a new marker when none is new', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ notes: { total: 1, unread: 0, accepting: false, closedReason: 'released' } })} />);
    expect(within(notesRow()).getByRole('link', { name: '1 note' })).toHaveAttribute('href', '#notes');
  });

  it('invites the first note while the window is open', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ notes: { total: 0, unread: 0, accepting: true, closedReason: null } })} />);
    expect(within(notesRow()).getByRole('link', { name: 'Add a note' })).toHaveAttribute('href', '#note-composer');
  });

  it('says No notes when there are none and the window is closed', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ notes: { total: 0, unread: 0, accepting: false, closedReason: 'not-submitted' } })} />);
    expect(notesRow()).toHaveTextContent('NotesNo notes');
    expect(within(notesRow()).queryByRole('link')).toBeNull();
  });

  it('adds no Notes row, count or marker when the read carries no notes summary (D-23)', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ notes: null })} />);
    expect(screen.queryByText('Notes', { selector: 'dt' })).toBeNull();
    expect(screen.queryByText(/new$/)).toBeNull();
  });
});

/*
 * 14-UI-SPEC §3.1 (UI-D2; X-10): the hub's Files row, after Notes, is a figure that opens the Files section, counting the
 * main list; with none it invites `Add files` while files can be added and reads `No files` otherwise. A read that
 * carries no file summary (another Requestor's, a participant's; D-18) adds no row.
 */
describe('RequestHub’s Files row (14-UI-SPEC §3.1)', () => {
  const summary = (overrides: Partial<NonNullable<CsrmAssessmentRequest['attachments']>> = {}): NonNullable<CsrmAssessmentRequest['attachments']> => ({
    count: 2, canAdd: true, refusal: null, window: 'after-submission', needsNote: true, remaining: 18, activeCount: 2, storedCount: 3,
    limits: { maxBytes: 26_214_400, maxActive: 20, maxStored: 60 }, allowedTypes: ['pdf', 'docx'], ...overrides,
  });

  function filesRow(): HTMLElement {
    return screen.getByText('Files', { selector: 'dt' }).parentElement as HTMLElement;
  }

  it('links the count of files to the Files section, after the Notes row', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ notes: { total: 0, unread: 0, accepting: true, closedReason: null }, attachments: summary() })} />);
    const link = within(filesRow()).getByRole('link', { name: '2 files' });
    expect(link).toHaveAttribute('href', '#files');
    const terms = Array.from(document.querySelectorAll('dt')).map((term) => term.textContent);
    expect(terms.indexOf('Files')).toBe(terms.indexOf('Notes') + 1);
  });

  it('counts one file in the singular', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ attachments: summary({ count: 1 }) })} />);
    expect(within(filesRow()).getByRole('link', { name: '1 file' })).toHaveAttribute('href', '#files');
  });

  it('invites Add files when there are none and files can be added', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ attachments: summary({ count: 0 }) })} />);
    expect(within(filesRow()).getByRole('link', { name: 'Add files' })).toHaveAttribute('href', '#files');
  });

  it('says No files when there are none and files cannot be added', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ attachments: summary({ count: 0, canAdd: false, refusal: 'ATTACHMENTS_CLOSED', window: 'closed' }) })} />);
    expect(filesRow()).toHaveTextContent('FilesNo files');
    expect(within(filesRow()).queryByRole('link')).toBeNull();
  });

  it('adds no Files row when the read carries no file summary (D-18)', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ attachments: undefined })} />);
    expect(screen.queryByText('Files', { selector: 'dt' })).toBeNull();
  });
});
