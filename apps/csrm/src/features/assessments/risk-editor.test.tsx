import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnalystAssessmentDetail, AnalystRiskDetail, RiskUpdateInput } from './assessment-schema';
import type { RiskAiProposalItem, RiskAiProposals, RiskAiRunFacts } from '@/features/risk-curation/risk-curation-domain';
import { causeChangeFixture, rewriteRunFixture, statementChangeFixture } from '@/features/risk-curation/test-fixtures';

/*
 * The Risk card's Phase 16 behaviour (16-UI-SPEC §4.2, §4.6, §6.1, §7, §12.3; D-17, D-45, UI-D8, UI-D17, UI-D28): Discard
 * new risk with Undo, the card actions, the `AI rewrite` slot and its link, and what the analyst who raised the request
 * keeps. The cards live in the assessment editor, so the editor is rendered with the served Risks and proposals read.
 */

const actionMocks = vi.hoisted(() => ({
  createControlImplementationAction: vi.fn(),
  createRiskAction: vi.fn(),
  deleteControlImplementationAction: vi.fn(),
  listControlImplementationsAction: vi.fn(),
  refreshAnalystAssessmentAction: vi.fn(),
  releaseAssessmentAction: vi.fn(),
  saveAssessmentAction: vi.fn(),
  updateControlImplementationAction: vi.fn(),
  updateRiskAction: vi.fn(),
}));
const curationActions = vi.hoisted(() => ({
  withdrawRisksAction: vi.fn(),
  reinstateRisksAction: vi.fn(),
  undoWithdrawalAction: vi.fn(),
  undoReinstatementAction: vi.fn(),
  readRiskHistoryAction: vi.fn(),
  startRiskSuggestionsAction: vi.fn(),
  startRiskRewriteAction: vi.fn(),
  readRiskProposalJobAction: vi.fn(),
  retryRiskProposalJobAction: vi.fn(),
  readRiskAiProposalsAction: vi.fn(),
  decideRiskProposalsAction: vi.fn(),
}));
vi.mock('./assessment-actions', () => actionMocks);
vi.mock('@/features/ai-assistance/ai-assistance-actions', () => ({ decideAiProposalsAction: vi.fn() }));
vi.mock('@/features/risk-curation/risk-curation-actions', () => curationActions);
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/review/assessments/assessment-1',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', TestResizeObserver);

import { AssessmentEditor } from './assessment-editor';
import { NavigationGuardProvider, useNavigationGuard } from '@/components/csrm/navigation-guard';

const analyst = { documentId: 'bob-id', displayName: 'Bob Doe' };
const riskValues: RiskUpdateInput = {
  issueStatement: 'Public endpoint', riskStatement: 'Files reconciled by hand', riskCategory: null, riskSubCategory: null,
  riskCause: 'Manual steps', potentialImpact: null, riskType: null, riskOwner: null, informationSystemImpacted: null,
  informationAssetImpacted: null, dataClassification: null, inherentLikelihood: null, highestInherentConsequence: null,
  inherentRating: null, inherentRatingRationale: null, residualLikelihood: null, highestResidualConsequence: null,
  residualRating: 'High', residualRatingRationale: null, controlEffectiveness: null, riskVelocity: null, identifiedDate: null,
  targetDate: null, closureDate: null, isExempted: null, exemptionReviewDate: null, escalationDetails: null, comments: null,
  riskCommunicationDate: null, treatmentAction: null, treatmentPlan: null, treatmentOwner: null, treatmentResolveDate: null,
  treatmentStatus: null,
};
const risk = { ...riskValues, documentId: 'r3', riskNumber: 'RSK-0003', riskStatement: 'Files reconciled by hand', inherentRating: null, residualRating: 'High', aiProvenance: null, withdrawal: null } as AnalystRiskDetail;
const withdrawnRisk: AnalystRiskDetail = { ...risk, documentId: 'r4', riskNumber: 'RSK-0004', withdrawal: { at: '2026-10-14T01:00:00.000Z', by: analyst, reason: 'Out of scope' } };
const assessment: AnalystAssessmentDetail = {
  actor: 'analyst', released: false, documentId: 'assessment-1', assessmentNumber: 'ASM-0001', assessmentStatus: 'in-review', assessmentDate: null,
  generatedDate: '2026-10-01T01:00:00.000Z', nextReviewDate: null, approvalDate: null, summary: 'Payments assessment.',
  overallRating: 'High', overallControlEffectiveness: null, recommendationsSummary: null, overallRiskRationale: null,
  assessmentRequest: { documentId: 'request-1', requestNumber: 'RAR-0001', title: 'Payments review', requestStatus: 'under-review' },
  generatedBy: analyst, reviewedBy: null, approvedBy: null, risks: [risk, withdrawnRisk], ownerLabels: [analyst], generation: null,
  aiProvenance: null, releaseReadiness: { ready: false, requirements: [] },
};
const allowed = { allowed: true, reason: null } as const;
const changes = [statementChangeFixture, causeChangeFixture] as unknown as RiskAiProposalItem[];
const withChanges: RiskAiProposals = {
  assessmentId: 'assessment-1', editable: true, openCount: 2, openByRisk: [{ riskId: 'r3', count: 2 }], lastAskedAt: null,
  actions: { suggest: allowed, rewrite: allowed, decide: allowed }, runs: [rewriteRunFixture as unknown as RiskAiRunFacts], items: changes, jobs: [],
};
const noProposals: RiskAiProposals = { ...withChanges, openCount: 0, openByRisk: [], runs: [], items: [] };
const searchOwners = vi.fn(async () => ({ ok: true as const, data: [analyst] }));

const editor = (extra: Partial<Parameters<typeof AssessmentEditor>[0]> = {}) => (
  <AssessmentEditor assessment={assessment} controlImplementations={{}} ownerKey="owner-a" proposals={noProposals} risks={[risk, withdrawnRisk]} searchOwners={searchOwners} {...extra} />
);
const card = () => document.getElementById('risk-r3')!;
/* Leaves through the guard's programmatic entry point (D-51), as a link's onNavigate does. */
function LeaveButton() {
  const guard = useNavigationGuard();
  return <button onClick={() => guard.navigate('/app/review/assessments')} type="button">Go to Assessments</button>;
}
const addRiskForm = () => screen.queryByRole('button', { name: 'Add risk' })?.closest('form') ?? null;

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/app/review/assessments/assessment-1');
  actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: assessment });
});
afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('Discard new risk (16-UI-SPEC §7; D-17, UI-D28)', () => {
  it('Discard new risk closes a form holding input and toasts with Undo, which reopens it with what was typed', async () => {
    const success = vi.spyOn(toast, 'success').mockImplementation(() => 'discarded');
    try {
      render(editor());
      await userEvent.click(screen.getByRole('button', { name: 'Add Risk' }));
      fireEvent.change(within(addRiskForm()!).getByRole('textbox', { name: 'Risk statement' }), { target: { value: 'Unsigned payment files' } });
      await userEvent.click(screen.getByRole('button', { name: 'Discard new risk' }));

      expect(addRiskForm()).toBeNull();
      expect(screen.getByRole('button', { name: 'Add Risk' })).toHaveFocus();
      expect(success).toHaveBeenCalledWith('New risk discarded.', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
      const undo = success.mock.calls[0]![1]!.action as { onClick: (event: unknown) => void };
      act(() => undo.onClick({}));

      const reopened = await waitFor(() => {
        const form = addRiskForm();
        expect(form).not.toBeNull();
        return form!;
      });
      expect(within(reopened).getByRole('textbox', { name: 'Risk statement' })).toHaveValue('Unsigned payment files');
      await waitFor(() => expect(within(reopened).getByRole('textbox', { name: 'Issue statement' })).toHaveFocus());
      // Nothing is sent, so nothing is recorded.
      expect(actionMocks.createRiskAction).not.toHaveBeenCalled();
    } finally {
      success.mockRestore();
    }
  });

  it('withdraws the discard’s Undo once a new Add Risk form opens, so it never does nothing (FE3-16)', async () => {
    const success = vi.spyOn(toast, 'success').mockImplementation(() => 'discarded');
    const dismiss = vi.spyOn(toast, 'dismiss');
    try {
      render(editor());
      await userEvent.click(screen.getByRole('button', { name: 'Add Risk' }));
      fireEvent.change(within(addRiskForm()!).getByRole('textbox', { name: 'Risk statement' }), { target: { value: 'Unsigned payment files' } });
      await userEvent.click(screen.getByRole('button', { name: 'Discard new risk' }));
      const toastId = (success.mock.calls[0]![1] as { id: string }).id;
      expect(dismiss).not.toHaveBeenCalledWith(toastId);

      await userEvent.click(screen.getByRole('button', { name: 'Add Risk' }));
      expect(dismiss).toHaveBeenCalledWith(toastId);
      expect(within(addRiskForm()!).getByRole('textbox', { name: 'Risk statement' })).toHaveValue('');
    } finally {
      success.mockRestore();
      dismiss.mockRestore();
    }
  });

  /*
   * Phase 16 validation audit (2026-10-16): D-17 and 16-14's truth say Phase 10's navigation guard warns on leaving with
   * input in the Add Risk form. The Risk's typed values live in client state only, so both an in-app link and a reload
   * would lose them: the guard asks first in the new Risk's words (16-UI-SPEC §7, amended 2026-10-16) and the browser warns.
   */
  it('warns on leaving while the Add Risk form holds input, and not once it is discarded (D-17, validation audit 2026-10-16)', async () => {
    const reload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    render(
      <NavigationGuardProvider>
        <LeaveButton />
        {editor()}
      </NavigationGuardProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add Risk' }));
    expect(reload(), 'LEAVE_WARNING_WHILE_UNTOUCHED').toBe(false);
    fireEvent.change(within(addRiskForm()!).getByRole('textbox', { name: 'Risk statement' }), { target: { value: 'Unsigned payment files' } });
    expect(reload(), 'NO_LEAVE_WARNING_WITH_INPUT').toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Go to Assessments' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Leave with a new risk not added?' });
    expect(dialog).toHaveAccessibleDescription('Your new risk hasn’t been added to this assessment. If you leave now, what you typed will be lost.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(within(addRiskForm()!).getByRole('textbox', { name: 'Risk statement' })).toHaveValue('Unsigned payment files');

    await userEvent.click(screen.getByRole('button', { name: 'Discard new risk' }));
    expect(reload(), 'LEAVE_WARNING_AFTER_DISCARD').toBe(false);
  });

  it('closes an untouched form with no toast and no Undo, and returns focus to Add Risk', async () => {
    const success = vi.spyOn(toast, 'success').mockImplementation(() => 'discarded');
    try {
      render(editor());
      await userEvent.click(screen.getByRole('button', { name: 'Add Risk' }));
      await userEvent.click(screen.getByRole('button', { name: 'Discard new risk' }));

      expect(addRiskForm()).toBeNull();
      expect(success).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Add Risk' })).toHaveFocus();
      expect(actionMocks.createRiskAction).not.toHaveBeenCalled();
    } finally {
      success.mockRestore();
    }
  });
});

describe('the Risk card’s actions and AI rewrite (16-UI-SPEC §4.2, §4.6, §6.1)', () => {
  it('offers Rewrite this risk, History and Withdraw risk on an active card', () => {
    render(editor());
    expect(within(card()).getByRole('button', { name: 'Rewrite this risk: RSK-0003' })).toBeInTheDocument();
    expect(within(card()).getByRole('button', { name: 'History of RSK-0003' })).toBeInTheDocument();
    expect(within(card()).getByRole('button', { name: 'Withdraw risk RSK-0003' })).toBeInTheDocument();
  });

  it('places the AI rewrite first in the card, linked from beside the Risk number', async () => {
    render(editor({ proposals: withChanges }));

    const link = within(card()).getByRole('link', { name: '2 AI changes to review' });
    expect(link).toHaveAttribute('href', '#risk-r3-rewrite');
    const heading = await within(card()).findByRole('heading', { level: 3, name: 'AI rewrite' });
    const section = document.getElementById('risk-r3-rewrite')!;
    expect(section).toContainElement(heading);
    const riskForm = within(card()).getByRole('button', { name: 'Save risk' }).closest('form')!;
    expect(section.compareDocumentPosition(riskForm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(section).getAllByRole('button', { name: /^Confirm: Risk statement on RSK-0003$/ }).length).toBeGreaterThan(0);
  });

  it('names the reason form each card action opens: Withdraw risk and Reinstate risk carry aria-controls (UI-01, Accessibility contract 4.1.2)', async () => {
    render(editor());
    const withdraw = within(card()).getByRole('button', { name: 'Withdraw risk RSK-0003' });
    expect(withdraw.getAttribute('aria-controls'), 'WITHDRAW_NO_ARIA_CONTROLS').toBeTruthy();
    await userEvent.click(withdraw);
    expect(withdraw).toHaveAttribute('aria-expanded', 'true');
    const withdrawForm = document.getElementById(withdraw.getAttribute('aria-controls')!);
    expect(withdrawForm, 'WITHDRAW_FORM_NOT_NAMED').not.toBeNull();
    expect(within(withdrawForm!).getByRole('textbox', { name: 'Reason for withdrawing' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Withdrawn (1)' }));
    const reinstate = within(document.getElementById('risk-r4')!).getByRole('button', { name: 'Reinstate risk RSK-0004' });
    expect(reinstate.getAttribute('aria-controls'), 'REINSTATE_NO_ARIA_CONTROLS').toBeTruthy();
    await userEvent.click(reinstate);
    expect(reinstate).toHaveAttribute('aria-expanded', 'true');
    const reinstateForm = document.getElementById(reinstate.getAttribute('aria-controls')!);
    expect(reinstateForm, 'REINSTATE_FORM_NOT_NAMED').not.toBeNull();
    expect(within(reinstateForm!).getByRole('textbox', { name: 'Reason for reinstating' })).toBeInTheDocument();
  });

  it('withholds Confirm while the Risk form holds unsaved edits', async () => {
    render(editor({ proposals: withChanges }));
    await within(card()).findByRole('heading', { level: 3, name: 'AI rewrite' });
    fireEvent.change(within(card()).getByRole('textbox', { name: 'Comments' }), { target: { value: 'Unsaved note' } });

    const section = document.getElementById('risk-r3-rewrite')!;
    await waitFor(() => expect(within(section).getByText('Save or discard your changes to this risk before you confirm AI changes.')).toBeInTheDocument());
    expect(within(section).queryByRole('button', { name: /^Confirm/ })).not.toBeInTheDocument();
  });

  it('asks the withdraw form to wait for unsaved edits (UI-D8)', async () => {
    render(editor());
    fireEvent.change(within(card()).getByRole('textbox', { name: 'Comments' }), { target: { value: 'Unsaved note' } });
    await userEvent.click(within(card()).getByRole('button', { name: 'Withdraw risk RSK-0003' }));

    expect(within(card()).getByText('This risk has unsaved changes. Save or discard them before you withdraw it.')).toBeInTheDocument();
    expect(within(card()).queryByRole('textbox', { name: 'Reason for withdrawing' })).not.toBeInTheDocument();
  });
});

describe('the requesting analyst’s Risk cards (16-UI-SPEC §12.3)', () => {
  it('the requesting analyst keeps editing, Withdraw risk, Reinstate risk, History and Discard new risk, with no rewrite', async () => {
    render(editor({ proposals: null, viewerRaisedRequest: true }));

    expect(within(card()).queryByRole('button', { name: /^Rewrite this risk/ })).not.toBeInTheDocument();
    expect(within(card()).queryByRole('link', { name: /AI changes? to review/ })).not.toBeInTheDocument();
    expect(document.getElementById('risk-r3-rewrite')).toBeNull();
    expect(within(card()).getByRole('button', { name: 'Save risk' })).toBeInTheDocument();
    expect(within(card()).getByRole('button', { name: 'Withdraw risk RSK-0003' })).toBeInTheDocument();
    expect(within(card()).getByRole('button', { name: 'History of RSK-0003' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add Risk' }));
    expect(screen.getByRole('button', { name: 'Discard new risk' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Withdrawn (1)' }));
    expect(within(document.getElementById('risk-r4')!).getByRole('button', { name: 'Reinstate risk RSK-0004' })).toBeInTheDocument();
  });
});
