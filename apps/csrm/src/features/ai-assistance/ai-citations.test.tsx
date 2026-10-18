import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const readAiSourceAction = vi.hoisted(() => vi.fn());
vi.mock('./ai-assistance-actions', () => ({ readAiSourceAction }));

import { AiCitations } from './ai-citations';
/* Loaded here first, so the citation's dynamic import of the source view resolves at once (ai-lazy-loading.test.tsx holds it back). */
import './ai-source-popover';
import type { AiCitationView } from './ai-provenance-domain';

const answer: AiCitationView = { key: 'answer.payment-files', kind: 'answer', label: 'Are payment files signed before upload?', section: 'Payment processing', classification: null };
const request: AiCitationView = { key: 'request.regulatoryRequirements', kind: 'request', label: 'Regulatory requirements', section: null, classification: null };
const system: AiCitationView = { key: 'system-1', kind: 'system', label: 'HR and payroll platform', section: null, classification: null };
const asset: AiCitationView = { key: 'asset-1', kind: 'asset', label: 'Employee payment details', section: null, classification: null };

describe('AiCitations (12-UI-SPEC §4.1)', () => {
  beforeEach(() => { vi.useFakeTimers(); readAiSourceAction.mockReset(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('lists each source under a Sources label, with answers and request fields as buttons', () => {
    render(<AiCitations fieldLabel="Risk statement" requestId="request-1" sources={[answer, request, system, asset]} />);
    expect(screen.getByText('Sources')).toHaveClass('micro-label');
    const list = screen.getByRole('list', { name: 'Sources for Risk statement' });
    const answerButton = within(list).getByRole('button', { name: 'Answer: Are payment files signed before upload?' });
    expect(answerButton).toHaveAttribute('aria-haspopup', 'dialog');
    expect(answerButton).toHaveAttribute('aria-expanded', 'false');
    expect(within(list).getByRole('button', { name: 'Request: Regulatory requirements' })).toBeInTheDocument();
    expect(within(list).getByText('System: HR and payroll platform').tagName).toBe('SPAN');
    expect(within(list).getByText('Asset: Employee payment details · Not classified')).toBeInTheDocument();
    expect(within(list).getAllByRole('button')).toHaveLength(2);
  });

  it('flags a statement that cites nothing', () => {
    render(<AiCitations fieldLabel="Summary" requestId="request-1" sources={[]} />);
    expect(screen.getByText('No source cited')).toBeInTheDocument();
    expect(screen.getByText('Check this statement against the request and answers.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('opens the answer in place: nothing for 300ms, a skeleton, then the question and the Requestor’s answer', async () => {
    let resolve!: (value: unknown) => void;
    readAiSourceAction.mockReturnValue(new Promise((next) => { resolve = next; }));
    render(<AiCitations fieldLabel="Risk statement" requestId="request-1" sources={[answer]} />);
    const citation = screen.getByRole('button', { name: /^Answer:/ });
    fireEvent.click(citation);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const dialog = screen.getByRole('dialog');
    expect(citation).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('heading', { level: 2, name: answer.label })).toHaveFocus();
    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(within(dialog).getByRole('status', { name: 'Loading this source' })).toBeInTheDocument();
    await act(async () => {
      resolve({ ok: true, data: { kind: 'answer', questionText: answer.label, section: 'Payment processing', helpText: 'Describe the integrity control.', answer: 'No, not yet', href: '/app/review/questionnaires/q-1' } });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(readAiSourceAction).toHaveBeenCalledTimes(1);
    expect(readAiSourceAction).toHaveBeenCalledWith({ requestId: 'request-1', sourceKey: 'answer.payment-files' });
    for (const text of ['Payment processing', 'Describe the integrity control.', 'Requestor’s answer', 'No, not yet']) expect(dialog).toHaveTextContent(text);
    expect(within(dialog).getByRole('link', { name: 'Open the questionnaire' })).toHaveAttribute('href', '/app/review/questionnaires/q-1');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(citation).toHaveFocus();
  });

  it('shows a request field and its record link', async () => {
    readAiSourceAction.mockResolvedValue({ ok: true, data: { kind: 'request', label: 'Regulatory requirements', value: null, requestNumber: 'RAR-2026-0001', href: '/app/review/requests/request-1' } });
    render(<AiCitations fieldLabel="Risk statement" requestId="request-1" sources={[request]} />);
    fireEvent.click(screen.getByRole('button', { name: /^Request:/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Not provided');
    expect(within(dialog).getByRole('link', { name: 'Open request RAR-2026-0001' })).toHaveAttribute('href', '/app/review/requests/request-1');
  });

  it.each([
    [{ ok: true, data: { kind: 'missing' } }, 'This source is no longer available.'],
    [{ ok: false, status: 403, failure: 'permission' }, 'You can’t open this source.'],
  ])('reads %o plainly', async (result, text) => {
    readAiSourceAction.mockResolvedValue(result);
    render(<AiCitations fieldLabel="Risk statement" requestId="request-1" sources={[answer]} />);
    fireEvent.click(screen.getByRole('button', { name: /^Answer:/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('dialog')).toHaveTextContent(text);
  });

  it('offers Try again after a failed read', async () => {
    readAiSourceAction.mockResolvedValueOnce({ ok: false, failure: 'error' }).mockResolvedValueOnce({ ok: true, data: { kind: 'missing' } });
    render(<AiCitations fieldLabel="Risk statement" requestId="request-1" sources={[answer]} />);
    fireEvent.click(screen.getByRole('button', { name: /^Answer:/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load this source.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('dialog')).toHaveTextContent('This source is no longer available.');
    expect(readAiSourceAction).toHaveBeenCalledTimes(2);
  });

  it('opens a bottom sheet with a visible Close below 768px', async () => {
    const matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query === '(max-width: 767px)', addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal('matchMedia', matchMedia);
    readAiSourceAction.mockResolvedValue({ ok: true, data: { kind: 'missing' } });
    render(<AiCitations fieldLabel="Risk statement" requestId="request-1" sources={[answer]} />);
    fireEvent.click(screen.getByRole('button', { name: /^Answer:/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const sheet = screen.getByRole('dialog');
    expect(sheet).toHaveClass('bottom-0');
    expect(within(sheet).getByRole('button', { name: 'Close source' })).toHaveTextContent('Close');
    vi.unstubAllGlobals();
  });

  /* UI-04 (direction §4 Side sheet, §3.10): the source's title is a panel title, as the run sheet's is, in either frame. */
  it.each([
    ['the popover from 768px', false],
    ['the bottom sheet below 768px', true],
  ])('titles the source in %s in the panel title style (UI-04)', async (_frame, phone) => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({ matches: phone && query === '(max-width: 767px)', addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    readAiSourceAction.mockResolvedValue({ ok: true, data: { kind: 'missing' } });
    render(<AiCitations fieldLabel="Risk statement" requestId="request-1" sources={[answer]} />);
    fireEvent.click(screen.getByRole('button', { name: /^Answer:/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const frame = screen.getByRole('dialog');
    expect(frame.classList.contains('bottom-0')).toBe(phone);
    const title = within(frame).getByRole('heading', { level: 2, name: answer.label });
    expect(title).toHaveClass('text-heading-sm', 'text-foreground');
    expect(title).not.toHaveClass('text-sm');
    expect(title).not.toHaveClass('font-medium');
  });

  /*
   * UI-06 (direction §4 Source citations, X-12): a citation keeps one line and ends in an ellipsis beyond 28rem, which is
   * `max-w-md`, the utility the long-text columns map the same 28rem to (X-3), not an arbitrary width. A citation button
   * fills its list item, which never outgrows the list, so no citation overflows at 375; plain text fills its item as a block.
   */
  it('caps each citation at the direction’s 28rem with its mapped utility, never an arbitrary width (UI-06)', () => {
    render(<AiCitations fieldLabel="Risk statement" requestId="request-1" sources={[answer, system]} />);
    const list = screen.getByRole('list', { name: 'Sources for Risk statement' });
    expect(within(list).getByRole('button', { name: /^Answer:/ })).toHaveClass('block', 'w-full', 'max-w-md', 'truncate');
    expect(within(list).getByText('System: HR and payroll platform')).toHaveClass('block', 'max-w-md', 'truncate');
    for (const item of within(list).getAllByRole('listitem')) expect(item).toHaveClass('min-w-0', 'max-w-full');
    expect(list.innerHTML).not.toMatch(/max-w-\[/);
  });
});
