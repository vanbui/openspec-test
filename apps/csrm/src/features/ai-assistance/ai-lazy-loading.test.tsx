import { Component, type ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ getAiRunAction: vi.fn(), readAiSourceAction: vi.fn() }));
vi.mock('./ai-assistance-actions', () => actions);

/*
 * WR-307: the sheet's and the source view's code load with a dynamic import, the first time an analyst asks for them
 * (D-36). The gate holds that import, as a slow connection does, or fails it, as a dropped connection or a redeploy's
 * chunk skew does; otherwise the real module loads. Each test mocks the two modules and reads the components afresh,
 * so no test meets an import an earlier one cached.
 */
const chunk = vi.hoisted(() => {
  const gate = { fail: false, hold: null as Promise<void> | null };
  return {
    gate,
    async load<T>(module: () => Promise<T>): Promise<T> {
      if (gate.hold) await gate.hold;
      if (gate.fail) throw new Error('Loading chunk failed.');
      return module();
    },
  };
});

/* The route's error boundary: reaching it replaces the whole editor, with every unsaved Risk form in it. */
class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p>The editor was replaced by the error page.</p> : this.props.children; }
}

const editorField = <textarea aria-label="Risk cause" defaultValue="An unsaved analyst revision" />;
const answer = { key: 'answer.payment-files', kind: 'answer' as const, label: 'Are payment files signed before upload?', section: 'Payment processing', classification: null };

function holdChunk(): () => void {
  let release!: () => void;
  chunk.gate.hold = new Promise((resolve) => { release = resolve; });
  return release;
}

async function renderSheetTrigger() {
  const { AiRunSheetTrigger } = await import('./ai-run-sheet-trigger');
  render(<RouteErrorBoundary>{editorField}<AiRunSheetTrigger kind="assessment" runId="run-1" /></RouteErrorBoundary>);
  return screen.getByRole('button', { name: 'Show what the AI used' });
}

async function renderCitations() {
  const { AiCitations } = await import('./ai-citations');
  render(<RouteErrorBoundary>{editorField}<AiCitations fieldLabel="Risk statement" requestId="request-1" sources={[answer]} /></RouteErrorBoundary>);
  return screen.getByRole('button', { name: `Answer: ${answer.label}` });
}

/* The editor stays, unsaved input and all. A modal sheet hides it from the accessibility tree while it is open. */
function expectEditorKept() {
  expect(screen.queryByText('The editor was replaced by the error page.')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Risk cause', hidden: true })).toHaveValue('An unsaved analyst revision');
}

beforeEach(() => {
  vi.resetModules();
  vi.doMock('./ai-run-sheet', async (importOriginal) => chunk.load(() => importOriginal()));
  vi.doMock('./ai-source-popover', async (importOriginal) => chunk.load(() => importOriginal()));
  vi.useFakeTimers();
  chunk.gate.fail = false;
  chunk.gate.hold = null;
  actions.getAiRunAction.mockReset().mockResolvedValue({ ok: false, status: 404, formError: 'x' });
  actions.readAiSourceAction.mockReset().mockResolvedValue({ ok: true, data: { kind: 'missing' } });
});
afterEach(() => vi.useRealTimers());

describe('What the AI used while its code loads (WR-307, 12-UI-SPEC §2.4)', () => {
  it('opens on nothing for 300ms, then the skeleton, until the code arrives', async () => {
    const release = holdChunk();
    fireEvent.click(await renderSheetTrigger());
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    const sheet = screen.getByRole('dialog', { name: 'What the AI used' });
    expect(within(sheet).getByRole('heading', { level: 2, name: 'What the AI used' })).toHaveFocus();
    expect(within(sheet).queryByRole('status')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(within(sheet).getByRole('status', { name: 'Loading what the AI used' })).toBeInTheDocument();

    await act(async () => { release(); });
    await vi.waitFor(() => expect(sheet).toHaveTextContent('No AI run record'));
    expect(actions.getAiRunAction).toHaveBeenCalledWith({ runId: 'run-1' });
    expect(within(sheet).queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the skeleton, with no gap, while the run is read after the code arrived late', async () => {
    const release = holdChunk();
    actions.getAiRunAction.mockReturnValue(new Promise(() => undefined));
    fireEvent.click(await renderSheetTrigger());
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    const sheet = screen.getByRole('dialog', { name: 'What the AI used' });
    expect(within(sheet).getByRole('status', { name: 'Loading what the AI used' })).toBeInTheDocument();
    await act(async () => { release(); });
    await vi.waitFor(() => expect(actions.getAiRunAction).toHaveBeenCalledWith({ runId: 'run-1' }));
    expect(within(sheet).getByRole('status', { name: 'Loading what the AI used' })).toBeInTheDocument();
  });

  it('says the sheet couldn’t load, keeps the editor, and loads it from Try again', async () => {
    chunk.gate.fail = true;
    fireEvent.click(await renderSheetTrigger());
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load what the AI used'));
    const sheet = screen.getByRole('dialog', { name: 'What the AI used' });
    expect(sheet).toHaveTextContent('Please try again. If the problem continues, contact your administrator.');
    expectEditorKept();

    chunk.gate.fail = false;
    fireEvent.click(within(sheet).getByRole('button', { name: 'Try again' }));
    expect(within(sheet).getByRole('heading', { level: 2, name: 'What the AI used' })).toHaveFocus();
    await vi.waitFor(() => expect(sheet).toHaveTextContent('No AI run record'));
    expectEditorKept();
  });
});

describe('A source while its code loads (WR-307, 12-UI-SPEC §4.2)', () => {
  it('opens on nothing for 300ms, then the skeleton, until the code arrives', async () => {
    const release = holdChunk();
    const citation = await renderCitations();
    fireEvent.click(citation);
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    const source = screen.getByRole('dialog', { name: answer.label });
    expect(citation).toHaveAttribute('aria-expanded', 'true');
    expect(within(source).getByRole('heading', { level: 2, name: answer.label })).toHaveFocus();
    expect(within(source).queryByRole('status')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(within(source).getByRole('status', { name: 'Loading this source' })).toBeInTheDocument();

    await act(async () => { release(); });
    await vi.waitFor(() => expect(source).toHaveTextContent('This source is no longer available.'));
    expect(actions.readAiSourceAction).toHaveBeenCalledWith({ requestId: 'request-1', sourceKey: answer.key });
  });

  it('keeps the skeleton, with no gap, while the source is read after the code arrived late', async () => {
    const release = holdChunk();
    actions.readAiSourceAction.mockReturnValue(new Promise(() => undefined));
    fireEvent.click(await renderCitations());
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    const source = screen.getByRole('dialog', { name: answer.label });
    expect(within(source).getByRole('status', { name: 'Loading this source' })).toBeInTheDocument();
    await act(async () => { release(); });
    await vi.waitFor(() => expect(actions.readAiSourceAction).toHaveBeenCalledWith({ requestId: 'request-1', sourceKey: answer.key }));
    expect(within(source).getByRole('status', { name: 'Loading this source' })).toBeInTheDocument();
  });

  it('says the source couldn’t load, keeps the editor, and loads it from Try again', async () => {
    chunk.gate.fail = true;
    fireEvent.click(await renderCitations());
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load this source.'));
    expectEditorKept();

    chunk.gate.fail = false;
    const source = screen.getByRole('dialog', { name: answer.label });
    fireEvent.click(within(source).getByRole('button', { name: 'Try again' }));
    expect(within(source).getByRole('heading', { level: 2, name: answer.label })).toHaveFocus();
    await vi.waitFor(() => expect(source).toHaveTextContent('This source is no longer available.'));
    expectEditorKept();
  });
});
