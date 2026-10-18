import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AttachmentActionResult } from './attachments-actions';
import type { RequestAttachment, RequestAttachmentAiPolicy } from './attachments-schema';

const mocks = vi.hoisted(() => ({
  setAttachmentAiInputAction: vi.fn(),
  getAttachmentAiTextAction: vi.fn(),
  successToast: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('./attachments-actions', () => ({
  setAttachmentAiInputAction: mocks.setAttachmentAiInputAction,
  getAttachmentAiTextAction: mocks.getAttachmentAiTextAction,
}));
vi.mock('@/components/ui/success-toast', () => ({ successToast: mocks.successToast }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('@/components/ui/toast-action', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/components/ui/toast-action')>();
  return { toastAction: vi.fn(original.toastAction) };
});

import { toastAction } from '@/components/ui/toast-action';
import { attachmentAiRefusal } from '@/lib/api/refusal-copy';
import { FileAiControl, type FileAiControlProps } from './file-ai-control';

const PACK = 'vendor-security-pack.pdf';

type Ai = NonNullable<RequestAttachment['ai']>;

function attachment(ai: Partial<Ai> = {}, overrides: Partial<RequestAttachment> = {}): RequestAttachment {
  return {
    documentId: 'att-pack', fileName: PACK, fileType: 'pdf', byteSize: 1457, state: 'available',
    uploadedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, uploaderPart: 'requestor', uploadedAt: '2026-10-10T01:00:00.000Z',
    note: null, removedBy: null, removedAt: null, detection: null, actions: { download: true, remove: true, restore: false },
    ai: { included: false, facts: null, unavailableReason: null, canChange: true, ...ai },
    ...overrides,
  };
}

const included960: Partial<Ai> = { included: true, facts: { available: 960, kept: 960, truncated: false } };

const allowed: RequestAttachmentAiPolicy = { canChange: true, refusal: null, classification: 'Internal', ceiling: 'Restricted' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function control(props: Partial<FileAiControlProps> = {}) {
  return render(<FileAiControl attachment={attachment()} layout="cell" policy={allowed} requestId="req-1" {...props} />);
}

const theSwitch = () => screen.getByRole('switch', { name: 'Changes the AI inputs' });

type ToastOptions = { action?: { label: string; onClick: (event?: unknown) => void }; description?: string };
function lastSuccessAction(): ToastOptions['action'] {
  return (mocks.successToast.mock.calls.at(-1)?.[1] as ToastOptions | undefined)?.action;
}

afterEach(() => {
  vi.clearAllMocks();
});

/*
 * 14-UI-SPEC §5.1, §9 (D-30, D-33; UI-D18 to UI-D20; X-18, X-22): a Security Analyst who did not raise the request
 * includes a clean, text-bearing file's text in the AI inputs. Turning it on waits for the server, which reads the
 * file's text; turning it off applies at once. Each change confirms with an Undo toast and a refusal says why.
 */
describe('the AI switch on a file (§5.1; X-18, X-22)', () => {
  it('is a switch labelled Changes the AI inputs, described by the file’s name and its facts, off with Not included', () => {
    control();
    expect(theSwitch()).not.toBeChecked();
    expect(theSwitch()).toHaveAccessibleDescription(`${PACK} Not included`);
    expect(screen.getByText('Not included', { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Preview text of ${PACK}` })).toBeNull();
  });

  /*
   * 14-UI-REVIEW UI-05 (X-22, "the switch waits for the server with `Reading the file’s text…` and the 16px inline
   * spinner"; direction §5 Optimistic UI, "inline 16px spinner"): the spinner is 16px, as the queue's `Adding…` is, and
   * static under reduced motion.
   */
  it('waits with the 16px inline spinner beside Reading the file’s text…, static under reduced motion (UI-05)', async () => {
    const user = userEvent.setup();
    const answer = deferred<AttachmentActionResult<RequestAttachment>>();
    mocks.setAttachmentAiInputAction.mockReturnValue(answer.promise);
    control();

    await user.click(theSwitch());
    const reading = screen.getByText('Reading the file’s text…', { exact: true });
    const spinner = reading.querySelector('svg');
    try {
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
      expect(spinner).toHaveClass('size-4', 'animate-spin', 'motion-reduce:animate-none');
      expect(spinner).not.toHaveClass('size-3');
    } finally {
      /* The server answers, so no change is left in flight for the next test. */
      await act(async () => answer.resolve({ ok: true, data: attachment(included960) }));
    }
  });

  it('turning it on waits with Reading the file’s text…, then shows the facts, Preview text and an Undo toast', async () => {
    const user = userEvent.setup();
    const answer = deferred<AttachmentActionResult<RequestAttachment>>();
    mocks.setAttachmentAiInputAction.mockReturnValue(answer.promise);
    control();

    await user.click(theSwitch());
    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledTimes(1);
    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-1', attachmentId: 'att-pack', included: true }));
    expect(theSwitch()).toBeChecked();
    expect(theSwitch().closest('[data-pending]')).toHaveAttribute('data-pending', 'true');
    expect(screen.getByText('Reading the file’s text…', { exact: true })).toBeInTheDocument();
    expect(mocks.successToast).not.toHaveBeenCalled();

    await act(async () => answer.resolve({ ok: true, data: attachment(included960) }));

    expect(theSwitch()).toBeChecked();
    expect(theSwitch().closest('[data-pending]')).toHaveAttribute('data-pending', 'false');
    expect(screen.getByText('Included · all 960 characters', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText('Reading the file’s text…')).toBeNull();
    expect(mocks.successToast).toHaveBeenCalledWith(`${PACK} included in the AI inputs.`, expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
    expect(toastAction).toHaveBeenCalledWith('Undo', expect.any(Function));
    const preview = screen.getByRole('button', { name: `Preview text of ${PACK}` });
    expect(preview).toHaveTextContent('Preview text');
    expect(preview).toHaveAttribute('aria-haspopup', 'dialog');
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('hands the answered file to the list, so every layout shows it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    mocks.setAttachmentAiInputAction.mockResolvedValue({ ok: true, data: attachment(included960) });
    control({ onChange });
    await user.click(theSwitch());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(attachment(included960)));
  });

  it('Undo sends included false, turns it off and says the file is no longer included', async () => {
    const user = userEvent.setup();
    mocks.setAttachmentAiInputAction
      .mockResolvedValueOnce({ ok: true, data: attachment(included960) })
      .mockResolvedValueOnce({ ok: true, data: attachment() });
    control();
    await user.click(theSwitch());
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));

    await act(async () => lastSuccessAction()?.onClick());

    expect(mocks.setAttachmentAiInputAction).toHaveBeenLastCalledWith(expect.objectContaining({ requestId: 'req-1', attachmentId: 'att-pack', included: false }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenLastCalledWith(`${PACK} no longer included.`));
    expect(theSwitch()).not.toBeChecked();
    expect(screen.getByText('Not included', { exact: true })).toBeInTheDocument();
  });

  it('says how much of a long file is sent: first 20,000 of 30,000 characters (D-33)', () => {
    control({ attachment: attachment({ included: true, facts: { available: 30_000, kept: 20_000, truncated: true } }) });
    expect(theSwitch()).toBeChecked();
    expect(screen.getByText('Included · first 20,000 of 30,000 characters', { exact: true })).toBeInTheDocument();
  });

  it('turning it off applies at once with its toast, and its Undo includes the file again once the server answers', async () => {
    const user = userEvent.setup();
    const answer = deferred<AttachmentActionResult<RequestAttachment>>();
    mocks.setAttachmentAiInputAction.mockReturnValueOnce(answer.promise);
    control({ attachment: attachment(included960) });

    await user.click(theSwitch());
    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledWith(expect.objectContaining({ included: false }));
    expect(theSwitch()).not.toBeChecked();
    expect(screen.getByText('Not included', { exact: true })).toBeInTheDocument();

    await act(async () => answer.resolve({ ok: true, data: attachment() }));
    expect(mocks.successToast).toHaveBeenCalledWith(`${PACK} no longer included in the AI inputs.`, expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));

    const again = deferred<AttachmentActionResult<RequestAttachment>>();
    mocks.setAttachmentAiInputAction.mockReturnValueOnce(again.promise);
    await act(async () => lastSuccessAction()?.onClick());
    expect(mocks.setAttachmentAiInputAction).toHaveBeenLastCalledWith(expect.objectContaining({ included: true }));
    expect(screen.getByText('Reading the file’s text…', { exact: true })).toBeInTheDocument();
    await act(async () => again.resolve({ ok: true, data: attachment(included960) }));
    expect(mocks.successToast).toHaveBeenLastCalledWith(`${PACK} included again.`);
    expect(screen.getByText('Included · all 960 characters', { exact: true })).toBeInTheDocument();
  });

  it('a refused inclusion turns the switch off and shows family P in a danger toast titled Inclusion not changed', async () => {
    const user = userEvent.setup();
    const message = 'CSRM couldn’t find text in this file, so it can’t be included. A scanned document needs a text layer.';
    mocks.setAttachmentAiInputAction.mockResolvedValue({ ok: false, kind: 'blocked', message, reason: 'ATTACHMENT_TEXT_UNAVAILABLE' });
    control();

    await user.click(theSwitch());

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(theSwitch()).not.toBeChecked();
    expect(screen.getByText('Not included', { exact: true })).toBeInTheDocument();
    const [title, options] = mocks.toastError.mock.calls[0] as [string, ToastOptions];
    expect(title).toBe('Inclusion not changed');
    expect(options.description).toBe(message);
    expect(options.action?.label).toBe('Refresh page');
    options.action?.onClick();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.successToast).not.toHaveBeenCalled();
  });

  it('rolls a failed exclusion back and offers Try again, which sends the same change', async () => {
    const user = userEvent.setup();
    mocks.setAttachmentAiInputAction
      .mockResolvedValueOnce({ ok: false, kind: 'retryable', message: 'We couldn’t change whether this file is included. Try again.' })
      .mockResolvedValueOnce({ ok: true, data: attachment() });
    control({ attachment: attachment(included960) });

    await user.click(theSwitch());
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(theSwitch()).toBeChecked();
    expect(screen.getByText('Included · all 960 characters', { exact: true })).toBeInTheDocument();
    const options = mocks.toastError.mock.calls[0]?.[1] as ToastOptions;
    expect(options.action?.label).toBe('Try again');

    await act(async () => options.action?.onClick());
    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledTimes(2);
    expect(mocks.setAttachmentAiInputAction).toHaveBeenLastCalledWith(expect.objectContaining({ included: false }));
    await waitFor(() => expect(theSwitch()).not.toBeChecked());
  });

  /* WR-204 (the stage B amendment): Strapi answers 503 ATTACHMENT_BUSY when its one extraction queue is full. */
  it('reads a 503 ATTACHMENT_BUSY as family P’s busy sentence, with Try again sending the same inclusion', async () => {
    const user = userEvent.setup();
    const busy = attachmentAiRefusal({ status: 503, reason: 'ATTACHMENT_BUSY' });
    mocks.setAttachmentAiInputAction
      .mockResolvedValueOnce({ ok: false, ...busy, reason: 'ATTACHMENT_BUSY' })
      .mockResolvedValueOnce({ ok: true, data: attachment(included960) });
    control();

    await user.click(theSwitch());
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(theSwitch()).not.toBeChecked();
    const [title, options] = mocks.toastError.mock.calls[0] as [string, ToastOptions];
    expect(title).toBe('Inclusion not changed');
    expect(options.description).toBe('CSRM is busy reading other files. Try again in a moment.');
    expect(options.action?.label).toBe('Try again');

    await act(async () => options.action?.onClick());
    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledTimes(2);
    expect(mocks.setAttachmentAiInputAction).toHaveBeenLastCalledWith(expect.objectContaining({ included: true }));
    await waitFor(() => expect(theSwitch()).toBeChecked());
  });

  it('treats a failure reaching the action as retryable, in family P’s words', async () => {
    const user = userEvent.setup();
    mocks.setAttachmentAiInputAction.mockRejectedValue(new Error('offline'));
    control();
    await user.click(theSwitch());
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Inclusion not changed', expect.objectContaining({ description: 'We couldn’t change whether this file is included. Try again.' })));
    expect(theSwitch()).not.toBeChecked();
  });

  it('says why an image can’t be included, with no switch', () => {
    control({ attachment: attachment({ unavailableReason: 'ATTACHMENT_NOT_TEXT_BEARING', canChange: false }, { documentId: 'att-diagram', fileName: 'diagram.png', fileType: 'png' }) });
    expect(screen.getByText('Images can’t be included, because the AI reads text only.', { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText('Not included')).toBeNull();
  });

  /*
   * IN-604: behaviour, not the module's text. Its client directive, its import graph (no zod, whichever way it imports)
   * and the preview sheet's lazy load are the boundary guard's (lib/performance/zod-client-boundary.test.ts).
   */
  it('confirms an inclusion and its Undo only through successToast, with toastAction’s Undo, never sonner’s own success toast', async () => {
    const user = userEvent.setup();
    mocks.setAttachmentAiInputAction
      .mockResolvedValueOnce({ ok: true, data: attachment(included960) })
      .mockResolvedValueOnce({ ok: true, data: attachment() });
    control();
    await user.click(theSwitch());
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    expect(toastAction).toHaveBeenCalledWith('Undo', expect.any(Function));
    expect(lastSuccessAction()).toBe(vi.mocked(toastAction).mock.results.at(-1)?.value);

    await act(async () => lastSuccessAction()?.onClick());
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(2));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});

/*
 * 14-UI-SPEC §5.1 (D-30; UI-D21, UI-D32; G-1) and the orchestrator's ruling on D-30: who gets a switch, and what every
 * other case shows. The switch renders only where Strapi's facts allow it; Strapi refuses every other caller (14-09).
 */
describe('where a file’s AI control shows no switch (§5.1; D-30)', () => {
  const ceiling: RequestAttachmentAiPolicy = { canChange: false, refusal: 'AI_CLASSIFICATION_ABOVE_CEILING', classification: 'Restricted', ceiling: 'Internal' };
  const notConfigured: RequestAttachmentAiPolicy = { canChange: false, refusal: 'AI_POLICY_NOT_CONFIGURED', classification: 'Internal', ceiling: null };

  it('says a file waiting for its malware check can be included once it passes, with no switch', () => {
    control({ attachment: attachment({ unavailableReason: 'ATTACHMENT_QUARANTINED', canChange: false }, { state: 'pending', actions: { download: false, remove: true, restore: false } }) });
    expect(screen.getByText('It can be included once it passes the malware check.', { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it.each(['blocked', 'unavailable'] as const)('shows nothing for a %s file', (state) => {
    const { container } = control({ attachment: attachment({ canChange: false }, { state, actions: { download: false, remove: true, restore: false } }) });
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the facts line as read-only fact on a released request, with no switch (UI-D32)', () => {
    control({ attachment: attachment({ ...included960, canChange: false }), policy: { canChange: false, refusal: 'ATTACHMENTS_CLOSED', classification: 'Internal', ceiling: 'Restricted' } });
    expect(screen.getByText('Included · all 960 characters', { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByRole('button', { name: `Preview text of ${PACK}` })).toBeInTheDocument();
  });

  it('gives the analyst who raised the request the facts and no switch or preview (G-1)', () => {
    control({ attachment: attachment({ ...included960, canChange: false }), policy: { canChange: false, refusal: 'OWN_REQUEST', classification: 'Internal', ceiling: 'Restricted' } });
    expect(screen.getByText('Included · all 960 characters', { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: `Preview text of ${PACK}` })).toBeNull();
  });

  it.each([
    ['AI_CLASSIFICATION_ABOVE_CEILING', ceiling],
    ['AI_POLICY_NOT_CONFIGURED', notConfigured],
  ] as const)('under %s a file not included has no switch and reads Not included', (_refusal, policy) => {
    control({ attachment: attachment({ canChange: false }), policy });
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText('Not included', { exact: true })).toBeInTheDocument();
  });

  /*
   * The orchestrator's ruling on D-30 (amending §5.1 for included files only): exclusion is always allowed, and taking
   * text away from the AI inputs must never be blocked, so under a refusing policy an included file keeps a switch that
   * can only turn it off. Once excluded, the switch goes, the line reads Not included, and the toast offers no Undo,
   * because the policy would refuse it.
   */
  it.each([
    ['AI_CLASSIFICATION_ABOVE_CEILING', ceiling],
    ['AI_POLICY_NOT_CONFIGURED', notConfigured],
  ] as const)('under %s an included file keeps an off-only switch, which goes once the file is excluded', async (_refusal, policy) => {
    const user = userEvent.setup();
    mocks.setAttachmentAiInputAction.mockResolvedValue({ ok: true, data: attachment({ canChange: true }) });
    control({ attachment: attachment(included960), policy });
    expect(theSwitch()).toBeChecked();
    expect(screen.getByText('Included · all 960 characters', { exact: true })).toBeInTheDocument();

    await user.click(theSwitch());

    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledWith(expect.objectContaining({ included: false, classification: policy.classification, ceiling: policy.ceiling }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`${PACK} no longer included in the AI inputs.`));
    expect(mocks.successToast.mock.calls[0]).toHaveLength(1);
    expect(screen.queryByRole('switch')).toBeNull();
    const line = screen.getByText('Not included', { exact: true });
    await waitFor(() => expect(line).toHaveFocus());
  });
});

/*
 * WR-404 (14-UI-SPEC §5.1; D-30, confirmed by the pilot): while a change is in flight the switch takes no input, says
 * so (`aria-disabled`) and keeps focus; an off-only switch never sends an inclusion.
 */
describe('the AI switch while its change is in flight (§5.1; WR-404)', () => {
  const ceiling: RequestAttachmentAiPolicy = { canChange: false, refusal: 'AI_CLASSIFICATION_ABOVE_CEILING', classification: 'Restricted', ceiling: 'Internal' };

  it('sends nothing on a second press during a pending exclusion, and keeps focus on the switch', async () => {
    const user = userEvent.setup();
    const answer = deferred<AttachmentActionResult<RequestAttachment>>();
    mocks.setAttachmentAiInputAction.mockReturnValue(answer.promise);
    control({ attachment: attachment(included960) });

    await user.click(theSwitch());
    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledTimes(1);
    expect(theSwitch()).toHaveAttribute('aria-disabled', 'true');
    await user.click(theSwitch());
    await user.keyboard(' ');

    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledTimes(1);
    expect(theSwitch()).toHaveFocus();
    expect(theSwitch()).not.toBeChecked();

    await act(async () => answer.resolve({ ok: true, data: attachment() }));
    expect(theSwitch()).not.toHaveAttribute('aria-disabled', 'true');
    expect(mocks.successToast).toHaveBeenCalledTimes(1);
  });

  it('sends one change only when toggled during Reading the file’s text…', async () => {
    const user = userEvent.setup();
    const answer = deferred<AttachmentActionResult<RequestAttachment>>();
    mocks.setAttachmentAiInputAction.mockReturnValue(answer.promise);
    control();

    await user.click(theSwitch());
    expect(screen.getByText('Reading the file’s text…', { exact: true })).toBeInTheDocument();
    await user.click(theSwitch());

    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledTimes(1);
    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledWith(expect.objectContaining({ included: true }));
    await act(async () => answer.resolve({ ok: true, data: attachment(included960) }));
    expect(mocks.successToast).toHaveBeenCalledTimes(1);
    expect(mocks.successToast).toHaveBeenCalledWith(`${PACK} included in the AI inputs.`, expect.anything());
  });

  it('never sends included: true from an off-only switch, however often it is pressed', async () => {
    const user = userEvent.setup();
    const answer = deferred<AttachmentActionResult<RequestAttachment>>();
    mocks.setAttachmentAiInputAction.mockReturnValue(answer.promise);
    control({ attachment: attachment(included960), policy: ceiling });

    await user.click(theSwitch());
    await user.click(theSwitch());
    await user.click(theSwitch());
    await act(async () => answer.resolve({ ok: true, data: attachment({ canChange: true }) }));

    expect(mocks.setAttachmentAiInputAction.mock.calls.map(([input]) => (input as { included: boolean }).included)).toEqual([false]);
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});

/* 14-UI-SPEC §5.3 (D-31; UI-D22): `Preview text` opens the text sheet, loaded on demand; focus comes back to it. */
describe('Preview text (§5.3)', () => {
  it('opens Text the AI will read, and Escape hands focus back to Preview text', async () => {
    const user = userEvent.setup();
    mocks.getAttachmentAiTextAction.mockResolvedValue({ ok: true, data: { text: 'After-hours support comes from an offshore team.', facts: { available: 48, kept: 48, truncated: false, extractor: 'csrm-text-1', extractedAt: '2026-10-10T02:00:00.000Z' } } });
    control({ attachment: attachment(included960) });
    const preview = screen.getByRole('button', { name: `Preview text of ${PACK}` });

    await user.click(preview);
    const sheet = await screen.findByRole('dialog', { name: 'Text the AI will read' });
    expect(await within(sheet).findByText('After-hours support comes from an offshore team.')).toBeInTheDocument();
    expect(mocks.getAttachmentAiTextAction).toHaveBeenCalledWith({ requestId: 'req-1', attachmentId: 'att-pack' });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(preview).toHaveFocus();
  });
});

/*
 * The pilot's walk, O9 (14-UI-SPEC §5.1; 4.1.2): the switch is described by the file's name and its facts line, so a
 * screen reader hears with its state whether the file is included and how much is sent, in the table and in the sheet.
 */
describe('the switch’s accessible description (§5.1; O9)', () => {
  it.each(['cell', 'sheet'] as const)('names the file and its facts in the %s layout, and follows them as they change', async (layout) => {
    const user = userEvent.setup();
    const answer = deferred<AttachmentActionResult<RequestAttachment>>();
    mocks.setAttachmentAiInputAction.mockReturnValue(answer.promise);
    control({ layout });
    expect(theSwitch()).toHaveAccessibleDescription(`${PACK} Not included`);

    await user.click(theSwitch());
    expect(theSwitch()).toHaveAccessibleDescription(`${PACK} Reading the file’s text…`);

    await act(async () => answer.resolve({ ok: true, data: attachment(included960) }));
    expect(theSwitch()).toHaveAccessibleDescription(`${PACK} Included · all 960 characters`);
  });

  it('says how much of a long file is sent', () => {
    control({ attachment: attachment({ included: true, facts: { available: 30_000, kept: 20_000, truncated: true } }) });
    expect(theSwitch()).toHaveAccessibleDescription(`${PACK} Included · first 20,000 of 30,000 characters`);
  });
});

/*
 * WR-405 and the pilot's walk, D4 (14-UI-SPEC §3.3: the sheet's AI switch "at full width and the touch-target height";
 * direction §4 Buttons, touch targets ≥44px below 768px): in the phone actions sheet the whole row is the switch's
 * label, full width at the touch-target height, so pressing anywhere on it toggles the switch, which keeps its role,
 * its name and its state. The table's cell keeps the 24px switch beside its label (2.5.8).
 */
describe('the AI switch’s row in the phone actions sheet (§3.3; WR-405, D4)', () => {
  it('is one full-width label at the touch-target height, and pressing the row toggles the switch', async () => {
    const user = userEvent.setup();
    mocks.setAttachmentAiInputAction.mockResolvedValue({ ok: true, data: attachment(included960) });
    control({ layout: 'sheet' });

    const row = theSwitch().closest('label');
    expect(row, 'the switch sits inside its label row').toBeInstanceOf(HTMLLabelElement);
    expect(row).toHaveClass('min-h-11', 'w-full');
    expect(row).toHaveTextContent('Changes the AI inputs');
    expect(row!.querySelectorAll('label')).toHaveLength(0);

    await user.click(row!);

    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledTimes(1);
    expect(mocks.setAttachmentAiInputAction).toHaveBeenCalledWith(expect.objectContaining({ included: true }));
    await waitFor(() => expect(theSwitch()).toBeChecked());
    expect(theSwitch()).toHaveAttribute('role', 'switch');
  });

  it('keeps the table cell’s switch beside its own label, outside any row label', () => {
    control({ layout: 'cell' });
    expect(theSwitch().closest('label')).toBeNull();
    expect(screen.getByText('Changes the AI inputs', { exact: true }).tagName).toBe('LABEL');
  });
});
