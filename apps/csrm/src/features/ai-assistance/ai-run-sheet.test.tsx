import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAiRunAction = vi.hoisted(() => vi.fn());
vi.mock('./ai-assistance-actions', () => ({ getAiRunAction }));

import { AiRunSheetBody } from './ai-run-sheet';
import { AiRunSheetFrame } from './ai-run-sheet-frame';
import { aiRunFixture } from './test-fixtures';

/* The sheet as its trigger renders it: the frame, and inside it the body whose code loads on demand (WR-307). */
function Harness({ kind = 'assessment' }: { kind?: 'assessment' | 'questionnaire' | 'questionnaire-proposals' }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  return (
    <>
      <button onClick={() => setOpen(true)} ref={trigger} type="button">Show what the AI used</button>
      <AiRunSheetFrame kind={kind} onOpenChange={setOpen} open={open} returnFocusTo={trigger} titleRef={title}>
        <AiRunSheetBody open={open} runId="run-1" titleRef={title} />
      </AiRunSheetFrame>
    </>
  );
}

async function openSheet(kind?: 'assessment' | 'questionnaire' | 'questionnaire-proposals') {
  render(<Harness kind={kind} />);
  fireEvent.click(screen.getByRole('button', { name: 'Show what the AI used' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  return screen.getByRole('dialog', { name: 'What the AI used' });
}

describe('What the AI used (12-UI-SPEC §2)', () => {
  beforeEach(() => { vi.useFakeTimers(); getAiRunAction.mockReset(); });
  afterEach(() => vi.useRealTimers());

  it('opens on the title, describes what was sent, and returns focus to the trigger on Escape', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: aiRunFixture });
    const dialog = await openSheet();
    expect(within(dialog).getByRole('heading', { level: 2, name: 'What the AI used' })).toHaveFocus();
    expect(dialog).toHaveAccessibleDescription('What CSRM sent to the AI for this draft. Requestor text was marked as information to analyse, never as instructions, and isn’t stored with this record.');
    expect(within(dialog).getByRole('button', { name: 'Close what the AI used' })).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show what the AI used' })).toHaveFocus();
  });

  it('shows nothing for 300ms, then the skeleton, while the run is read', async () => {
    getAiRunAction.mockReturnValue(new Promise(() => undefined));
    const dialog = await openSheet();
    expect(within(dialog).queryByRole('status', { name: 'Loading what the AI used' })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(within(dialog).getByRole('status', { name: 'Loading what the AI used' })).toBeInTheDocument();
  });

  it('lays out a draft run in the UI-SPEC groups', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: aiRunFixture });
    const dialog = await openSheet();
    const groups = within(dialog).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(groups).toEqual(['Run', 'Data policy', 'Request', 'Notes', 'Files', 'Questions and answers', 'Information systems', 'Information assets', 'Risk Types', 'Control candidates', 'Context digest']);
    for (const text of ['Morgan Analyst', 'deterministic-assessment-draft', 'Completed', 'Restricted', 'From the request’s information assets',
      'No limit set in development', 'Allowed', 'Request title', '1 of 1 question answered', 'Are payment files signed?', 'Payment processing',
      'Finance system', 'Employee payment details · Restricted', '4 of 4 offered', '12 of 2646 library controls offered',
      'A SHA-256 fingerprint of the exact text sent to the AI.']) {
      expect(dialog).toHaveTextContent(text);
    }
    expect(within(dialog).getByText(aiRunFixture.contextSummary.digest)).toHaveClass('font-mono');
    expect(dialog).not.toHaveTextContent(/less relevant/);
  });

  /*
   * The pilot's walk: a group heading set as a micro-label read the same as the row labels under it. Group headings take
   * the direction's panel heading style (§3.10 --text-heading-sm); row labels stay micro-labels (12-UI-SPEC §2.2).
   */
  it('sets each group heading in the panel heading style, apart from its micro-label row labels', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: aiRunFixture });
    const dialog = await openSheet();
    const headings = within(dialog).getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(11);
    for (const heading of headings) {
      expect(heading).toHaveClass('text-heading-sm', 'text-foreground');
      expect(heading).not.toHaveClass('micro-label');
    }
    const labels = dialog.querySelectorAll('dt');
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label).toHaveClass('micro-label');
  });

  /* Walk D11 (12-UI-SPEC voice rules): a request field is named by its Phase 10 §9.1 label, as the request form names it. */
  it('names each request field sent by the request’s own label', async () => {
    const fields = ['request.title', 'request.description', 'request.businessPurpose'].map((key) => ({ key, label: key, characters: 20 }));
    getAiRunAction.mockResolvedValue({ ok: true, data: { ...aiRunFixture, contextSummary: { ...aiRunFixture.contextSummary, request: { fields } } } });
    const dialog = await openSheet();
    const sent = within(dialog).getByText('Fields sent').nextElementSibling as HTMLElement;
    expect(within(sent).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Request title', 'Description', 'Business purpose']);
    expect(dialog).not.toHaveTextContent('Request description');
  });

  it('leaves out the draft-only groups for a questionnaire run, and reads empty lists plainly', async () => {
    const summary = { ...aiRunFixture.contextSummary, operation: 'questionnaire-generation', systems: [], assets: [], riskTypes: { offered: 2, total: 5, names: ['A', 'B'] } };
    getAiRunAction.mockResolvedValue({ ok: true, data: { ...aiRunFixture, operation: 'questionnaire-generation', contextSummary: summary, status: 'failed', failureMessage: 'Provider timed out.' } });
    const dialog = await openSheet('questionnaire');
    expect(dialog).toHaveAccessibleDescription(/for this questionnaire\./);
    expect(within(dialog).queryByRole('heading', { name: 'Questions and answers' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: 'Control candidates' })).not.toBeInTheDocument();
    expect(within(dialog).getAllByText('None selected')).toHaveLength(2);
    expect(dialog).toHaveTextContent('3 less relevant Risk Types were left out.');
    expect(dialog).toHaveTextContent('Failed: Provider timed out.');
  });

  /*
   * Phase 13 D-28 (13-UI-SPEC §10.3): the notes a run used, after Request: how many, then one row per note by part, time
   * and length, the first part a link to the note in the thread that closes the sheet and then navigates. Never its text.
   */
  it('names each note the run included by part, time and length, linking to it in the thread', async () => {
    const included = [{ documentId: 'note-1', part: 'requestor', sequence: 1, postedAt: '2026-10-04T23:00:00.000Z', characters: 120 }];
    getAiRunAction.mockResolvedValue({ ok: true, data: { ...aiRunFixture, contextSummary: { ...aiRunFixture.contextSummary, notes: { included, marked: 1, bound: 50 } } } });
    const dialog = await openSheet();
    const group = within(dialog).getByRole('heading', { level: 3, name: 'Notes' }).closest('section')!;
    expect(group).toHaveTextContent('1 note included');
    const rows = within(group).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent?.replace(/\s/g, ' ')).toMatch(/^Requestor note · 4 Oct 2026, 11:00 pm UTC · 120 characters$/);
    const link = within(rows[0]!).getByRole('link', { name: 'Requestor note' });
    expect(link).toHaveAttribute('href', '/app/review/requests/request-1#note-note-1');
    expect(link).toHaveClass('record-link');
    expect(link).not.toHaveAttribute('type');
    fireEvent.click(link);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * UI-07 (13-UI-SPEC §10.3, amended 2026-10-10): the Notes group is laid out as every other group is, a `dt.micro-label`
   * over its `dd`, with the count and the per-note rows in the `dd`, the words unchanged (WR-607's browser assertion).
   */
  it('lays the Notes group out as the sheet’s other groups, a micro-label term over the count and rows', async () => {
    const included = [{ documentId: 'note-1', part: 'requestor', sequence: 1, postedAt: '2026-10-04T23:00:00.000Z', characters: 120 }];
    getAiRunAction.mockResolvedValue({ ok: true, data: { ...aiRunFixture, contextSummary: { ...aiRunFixture.contextSummary, notes: { included, marked: 1, bound: 50 } } } });
    const dialog = await openSheet();
    const group = within(dialog).getByRole('heading', { level: 3, name: 'Notes' }).closest('section')!;
    const list = group.querySelector(':scope > dl');
    expect(list).not.toBeNull();
    const terms = [...list!.querySelectorAll('dt')];
    expect(terms.map((term) => term.textContent)).toEqual(['Included']);
    expect(terms[0]).toHaveClass('micro-label');
    const value = terms[0]!.nextElementSibling as HTMLElement;
    expect(value.tagName).toBe('DD');
    expect(within(value).getByText('1 note included', { exact: true })).toHaveClass('tabular-nums');
    expect(within(value).getAllByRole('listitem')).toHaveLength(1);
    expect(within(value).getByRole('link', { name: 'Requestor note' })).toBeInTheDocument();
  });

  it('counts many notes in the plural and words one character in the singular', async () => {
    const included = [
      { documentId: 'note-1', part: 'requestor', sequence: 1, postedAt: '2026-10-04T23:00:00.000Z', characters: 1 },
      { documentId: 'note-2', part: 'security-analyst', sequence: 2, postedAt: '2026-10-04T23:05:00.000Z', characters: 2_400 },
    ];
    getAiRunAction.mockResolvedValue({ ok: true, data: { ...aiRunFixture, contextSummary: { ...aiRunFixture.contextSummary, notes: { included, marked: 2, bound: 50 } } } });
    const dialog = await openSheet();
    const group = within(dialog).getByRole('heading', { level: 3, name: 'Notes' }).closest('section')!;
    expect(group).toHaveTextContent('2 notes included');
    const rows = within(group).getAllByRole('listitem').map((row) => row.textContent);
    expect(rows[0]).toMatch(/ · 1 character$/);
    expect(rows[1]).toMatch(/^Security Analyst note · .* · 2,400 characters$/);
  });

  it.each([
    ['a run that included none', { included: [], marked: 0, bound: 50 }, 2],
    ['an earlier (v1) run', { included: [], marked: 0, bound: 50 }, 1],
  ] as const)('reads None included under Notes for %s', async (_label, notes, schemaVersion) => {
    getAiRunAction.mockResolvedValue({ ok: true, data: { ...aiRunFixture, contextSummary: { ...aiRunFixture.contextSummary, schemaVersion, notes } } });
    const dialog = await openSheet();
    const group = within(dialog).getByRole('heading', { level: 3, name: 'Notes' }).closest('section')!;
    expect(group).toHaveTextContent(/^Notes\s*Included\s*None included$/);
    expect(within(group).queryByRole('link')).not.toBeInTheDocument();
  });

  it('names a note without a link when the run names no request', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: { ...aiRunFixture, targets: { ...aiRunFixture.targets, assessmentRequest: null } } });
    const dialog = await openSheet();
    const group = within(dialog).getByRole('heading', { level: 3, name: 'Notes' }).closest('section')!;
    expect(group).toHaveTextContent('Requestor note · ');
    expect(within(group).queryByRole('link')).not.toBeInTheDocument();
  });

  /*
   * Phase 14 D-35 (14-UI-SPEC §7.1; UI-D23): the files a run used, after Notes: how many, then one row per file in upload
   * order, named as it is now, its link a record link to the file's row on the analyst's request page that closes the
   * sheet and then navigates, and the part, the characters sent, any truncation and a later removal. Never its text.
   */
  const packEntry = {
    documentId: 'att-pack', sha256: 'b'.repeat(64), type: 'pdf', part: 'requestor', charactersSent: 960, charactersAvailable: 960,
    truncated: false, fileName: 'vendor-security-pack.pdf', requestId: 'request-1', removed: false,
  } as const;

  function withFiles(included: readonly object[]) {
    return { ok: true, data: { ...aiRunFixture, contextSummary: { ...aiRunFixture.contextSummary, attachments: { included, bound: 60_000 } } } };
  }

  async function filesGroup(): Promise<HTMLElement> {
    const dialog = await openSheet();
    return within(dialog).getByRole('heading', { level: 3, name: 'Files' }).closest('section')!;
  }

  it('names each file the run included by its current name, part and characters sent, linking to its row', async () => {
    getAiRunAction.mockResolvedValue(withFiles([packEntry]));
    const group = await filesGroup();
    expect(within(group).getByText('1 file included', { exact: true })).toHaveClass('tabular-nums');
    const rows = within(group).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent?.replace(/\s/g, ' ')).toBe('vendor-security-pack.pdf · Requestor file · 960 characters sent');
    const link = within(rows[0]!).getByRole('link', { name: 'vendor-security-pack.pdf' });
    expect(link).toHaveAttribute('href', '/app/review/requests/request-1#file-att-pack');
    expect(link).toHaveClass('record-link');
    fireEvent.click(link);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says how much of a long file was sent, and that a file was removed since, in upload order', async () => {
    getAiRunAction.mockResolvedValue(withFiles([
      { ...packEntry, documentId: 'att-long', part: 'security-analyst', charactersSent: 20_000, charactersAvailable: 30_000, truncated: true, fileName: 'supplier-controls.txt', type: 'txt' },
      { ...packEntry, removed: true },
    ]));
    const group = await filesGroup();
    expect(within(group).getByText('2 files included', { exact: true })).toBeInTheDocument();
    const rows = within(group).getAllByRole('listitem').map((row) => row.textContent?.replace(/\s/g, ' '));
    expect(rows).toEqual([
      'supplier-controls.txt · Security Analyst file · 20,000 characters sent · first 20,000 of 30,000',
      'vendor-security-pack.pdf · Requestor file · 960 characters sent · Removed since',
    ]);
  });

  /* WR-506: a file removed since the run has no row in the main list, so its name is plain text; one still listed links. */
  it('names a file removed since the run as text with no link, and still links a file that is listed (WR-506)', async () => {
    getAiRunAction.mockResolvedValue(withFiles([
      { ...packEntry, documentId: 'att-long', fileName: 'supplier-controls.txt', type: 'txt' },
      { ...packEntry, removed: true },
    ]));
    const group = await filesGroup();
    const rows = within(group).getAllByRole('listitem');
    expect(within(rows[0]!).getByRole('link', { name: 'supplier-controls.txt' })).toHaveAttribute('href', '/app/review/requests/request-1#file-att-long');
    expect(within(rows[1]!).queryByRole('link')).toBeNull();
    expect(rows[1]!.textContent?.replace(/\s/g, ' ')).toBe('vendor-security-pack.pdf · Requestor file · 960 characters sent · Removed since');
    expect(group.querySelector('a[href*="#file-att-pack"]')).toBeNull();
  });

  it.each([
    ['a run that included none', 3],
    ['an earlier (v2) run', 2],
  ] as const)('reads None included under Files for %s', async (_label, schemaVersion) => {
    getAiRunAction.mockResolvedValue({ ok: true, data: { ...aiRunFixture, contextSummary: { ...aiRunFixture.contextSummary, schemaVersion, attachments: { included: [], bound: 60_000 } } } });
    const group = await filesGroup();
    expect(group).toHaveTextContent(/^Files\s*Included\s*None included$/);
    expect(within(group).queryByRole('link')).not.toBeInTheDocument();
  });

  it('names a file without a link when its record no longer names a request', async () => {
    getAiRunAction.mockResolvedValue(withFiles([{ ...packEntry, fileName: null, requestId: null, removed: true }]));
    const group = await filesGroup();
    expect(within(group).queryByRole('link')).not.toBeInTheDocument();
    expect(within(group).getByRole('listitem').textContent?.replace(/\s/g, ' ')).toBe('A file no longer on this request · Requestor file · 960 characters sent · Removed since');
  });

  it.each([
    [{ ok: false, status: 404, formError: 'x' }, 'No AI run record', 'CSRM holds no record of what this generation used.'],
    [{ ok: true, data: { ...aiRunFixture, contextSummary: null } }, 'No AI run record', 'CSRM holds no record of what this generation used.'],
    [{ ok: false, status: 403, formError: 'x' }, 'You don’t have access to this AI run', 'Only Security Analysts can see what an AI run used.'],
  ])('reads %o as its state', async (result, title, description) => {
    getAiRunAction.mockResolvedValue(result);
    const dialog = await openSheet();
    expect(dialog).toHaveTextContent(title);
    expect(dialog).toHaveTextContent(description);
  });

  it('offers Try again after a failed read, keeping focus on the title', async () => {
    getAiRunAction.mockResolvedValueOnce({ ok: false, status: 500, formError: 'x' }).mockResolvedValueOnce({ ok: true, data: aiRunFixture });
    const dialog = await openSheet();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('We couldn’t load what the AI used');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(within(dialog).getByRole('heading', { level: 2, name: 'What the AI used' })).toHaveFocus();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(dialog).toHaveTextContent('Morgan Analyst');
    expect(getAiRunAction).toHaveBeenCalledTimes(2);
  });

  it('fills the screen below 768px and becomes a 640px side sheet from 768px', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: aiRunFixture });
    const dialog = await openSheet();
    expect(dialog).toHaveClass('inset-0', 'md:left-auto', 'md:w-[min(640px,100vw)]', 'md:border-l');
  });
});

/* Phase 15 (15-UI-SPEC §9.3; D-14, D-19; U6): the Instruction and Questionnaire groups of a proposal or rewrite run. */
describe('What the AI used for questionnaire proposals (Phase 15)', () => {
  beforeEach(() => { vi.useFakeTimers(); getAiRunAction.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  const questionnaire = { scope: 'questionnaire', questionsOffered: 12, answered: 4, answerContent: 'included', openItemsListed: 3, rejectedItemsListed: 2, rejectedItemsTotal: 5, removedListed: 1 };
  function proposalRun(overrides: Record<string, unknown> = {}, summary: Record<string, unknown> = {}) {
    return {
      ...aiRunFixture,
      operation: 'questionnaire-proposals',
      initiatedBy: { documentId: 'analyst-2', displayName: 'Bob Doe' },
      instruction: 'Add questions about the offshore support team',
      contextSummary: { ...aiRunFixture.contextSummary, schemaVersion: 4, operation: 'questionnaire-proposals', questionnaire, instruction: { source: 'analyst' }, ...summary },
      ...overrides,
    };
  }

  it('describes what was sent for these proposals', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: proposalRun() });
    const dialog = await openSheet('questionnaire-proposals');
    expect(dialog).toHaveAccessibleDescription('What CSRM sent to the AI for these proposals. Requestor text was marked as information to analyse, never as instructions, and isn’t stored with this record.');
  });

  it('names who gave the instruction and shows it in typographic quotes, as text', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: proposalRun({ instruction: 'Add questions about the <b>offshore</b> support team' }) });
    const dialog = await openSheet('questionnaire-proposals');
    const group = within(dialog).getByRole('heading', { name: 'Instruction' }).parentElement!;
    expect(group).toHaveTextContent('Given byBob Doe');
    expect(group).toHaveTextContent('Instruction“Add questions about the <b>offshore</b> support team”');
    expect(group.querySelector('b')).toBeNull();
  });

  it('says what steered a preset rewrite and the default task', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: proposalRun({ operation: 'question-rewrite', instruction: null }, { instruction: { source: 'plain-language-preset' }, questionnaire: { ...questionnaire, scope: 'question' } }) });
    let dialog = await openSheet('questionnaire-proposals');
    expect(dialog).toHaveTextContent('Plain-language rewrite (standard wording)');
    expect(within(dialog).getByRole('heading', { name: 'Instruction' }).parentElement).not.toHaveTextContent('“');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    document.body.innerHTML = '';
    getAiRunAction.mockResolvedValue({ ok: true, data: proposalRun({ instruction: null }, { instruction: { source: 'default-task' } }) });
    dialog = await openSheet('questionnaire-proposals');
    expect(dialog).toHaveTextContent('None: the AI suggested the questions it judged still needed');
  });

  it('lays out the Questionnaire group', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: proposalRun() });
    const dialog = await openSheet('questionnaire-proposals');
    const group = within(dialog).getByRole('heading', { name: 'Questionnaire' }).parentElement!;
    expect(group).toHaveTextContent('ScopeWhole questionnaire');
    expect(group).toHaveTextContent('Questions offered12');
    expect(group).toHaveTextContent('Answered4 (the AI couldn’t change them)');
    expect(group).toHaveTextContent('AnswersIncluded, because the Requestor had submitted them');
    expect(group).toHaveTextContent('Open proposals listed3');
    expect(group).toHaveTextContent('Rejected proposals listed2 of 5');
    expect(group).toHaveTextContent('Removed questions listed1');
  });

  it('says answers were withheld while the Requestor had not submitted them, and names a one-question scope', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: proposalRun({ operation: 'question-rewrite' }, { questionnaire: { ...questionnaire, scope: 'question', answerContent: 'withheld' } }) });
    const dialog = await openSheet('questionnaire-proposals');
    const group = within(dialog).getByRole('heading', { name: 'Questionnaire' }).parentElement!;
    expect(group).toHaveTextContent('AnswersNot included, because the Requestor hadn’t submitted them');
    expect(group).toHaveTextContent('ScopeOne question');
  });

  it('shows neither group for a generation run without the sections', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: { ...aiRunFixture, contextSummary: { ...aiRunFixture.contextSummary, questionnaire: null, instruction: null } } });
    const dialog = await openSheet();
    expect(within(dialog).queryByRole('heading', { name: 'Instruction' })).toBeNull();
    expect(within(dialog).queryByRole('heading', { name: 'Questionnaire' })).toBeNull();
  });
});

describe('What the AI used for risk proposals (Phase 16; 16-UI-SPEC §10.3)', () => {
  beforeEach(() => { vi.useFakeTimers(); getAiRunAction.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  const section = { scope: 'assessment', risksListed: 6, withdrawnListed: 2, rejectedListed: 3, openListed: 1, controlsListed: null, focus: null };
  function riskRun(overrides: Record<string, unknown> = {}, summary: Record<string, unknown> = {}) {
    return {
      ...aiRunFixture,
      operation: 'risk-suggestions',
      instruction: null,
      contextSummary: { ...aiRunFixture.contextSummary, schemaVersion: 5, operation: 'risk-suggestions', instruction: { source: 'default-task' }, riskProposals: section, ...summary },
      targets: { ...aiRunFixture.targets, risk: null },
      ...overrides,
    };
  }

  function RiskHarness({ riskNumber }: { riskNumber?: string }) {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const title = useRef<HTMLHeadingElement>(null);
    return (
      <>
        <button onClick={() => setOpen(true)} ref={trigger} type="button">Show what the AI used</button>
        <AiRunSheetFrame kind="questionnaire-proposals" onOpenChange={setOpen} open={open} returnFocusTo={trigger} titleRef={title}>
          <AiRunSheetBody open={open} riskNumber={riskNumber} runId="run-1" titleRef={title} />
        </AiRunSheetFrame>
      </>
    );
  }

  async function openRiskSheet(riskNumber?: string) {
    render(<RiskHarness riskNumber={riskNumber} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show what the AI used' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    return screen.getByRole('dialog', { name: 'What the AI used' });
  }

  it('says a suggestions request without an instruction looked for the risks it judged missing, and lays out the Assessment group', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: riskRun() });
    const dialog = await openRiskSheet();
    expect(within(dialog).getByRole('heading', { name: 'Instruction' }).parentElement).toHaveTextContent('Given byNone: the AI looked for the risks it judged missing');
    const group = within(dialog).getByRole('heading', { name: 'Assessment' }).parentElement!;
    expect(group).toHaveTextContent('ScopeWhole assessment');
    expect(group).toHaveTextContent('Risks listed6');
    expect(group).toHaveTextContent('Withdrawn risks listed2');
    expect(group).toHaveTextContent('Earlier proposals listed3 rejected · 1 open');
    expect(group).not.toHaveTextContent('Mitigation controls listed');
    expect(within(dialog).queryByText('What to rewrite')).toBeNull();
  });

  it('names one risk for a rewrite, with its mitigation controls and the parts asked for', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: riskRun({ operation: 'risk-rewrite', targets: { ...aiRunFixture.targets, risk: 'r3' } }, { operation: 'risk-rewrite', riskProposals: { ...section, scope: 'risk', controlsListed: 2, focus: ['statement', 'ratings'] } }) });
    const dialog = await openRiskSheet('R-3');
    const instruction = within(dialog).getByRole('heading', { name: 'Instruction' }).parentElement!;
    expect(instruction).toHaveTextContent('Given byNone: the AI rewrote the parts asked for');
    expect(instruction).toHaveTextContent('What to rewriteStatement and cause, Ratings');
    const group = within(dialog).getByRole('heading', { name: 'Assessment' }).parentElement!;
    expect(group).toHaveTextContent('ScopeOne risk: R-3');
    expect(group).toHaveTextContent('Mitigation controls listed2');
  });

  it('names who gave a risk instruction and shows it quoted, as text', async () => {
    getAiRunAction.mockResolvedValue({ ok: true, data: riskRun({ instruction: 'Risks about <i>payment</i> files' }, { instruction: { source: 'analyst' } }) });
    const dialog = await openRiskSheet();
    const group = within(dialog).getByRole('heading', { name: 'Instruction' }).parentElement!;
    expect(group).toHaveTextContent('Given byMorgan Analyst');
    expect(group).toHaveTextContent('Instruction“Risks about <i>payment</i> files”');
    expect(group.querySelector('i')).toBeNull();
  });
});
