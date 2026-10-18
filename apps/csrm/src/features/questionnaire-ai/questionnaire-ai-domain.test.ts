import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  citationLabel,
  decidedNote,
  decisionFailureTitle,
  decisionToast,
  draftGateLine,
  emptyState,
  fixedQuestionsToggle,
  hubProposalsLine,
  instructionCountLine,
  instructionTooLongLine,
  itemActionsFor,
  itemEyebrow,
  itemSubject,
  leftOutCount,
  leftOutLabel,
  leftOutLines,
  panelGuidance,
  panelStatusLine,
  placementLine,
  pluralise,
  proposedCaption,
  releaseGateLine,
  replaceOffer,
  runFactsLine,
  runGroupHeading,
  staleLine,
  startActionLabel,
  unmatchedSourcesCaption,
  visibilityLine,
  type ProposalQuestionnaireState,
  type QuestionnaireAiItemView,
  type QuestionnaireAiProposalsView,
  type QuestionnaireAiRunView,
} from './questionnaire-ai-domain';
import { proposalsFixture } from './test-fixtures';

const view = proposalsFixture as unknown as QuestionnaireAiProposalsView;
const run = view.runs[0] as QuestionnaireAiRunView;
const openAdd = view.items[0] as QuestionnaireAiItemView;
const confirmedChange = view.items[1] as QuestionnaireAiItemView;
const withState = (state: ProposalQuestionnaireState): QuestionnaireAiProposalsView => ({ ...view, state });

/* Every string the domain returns, gathered for the voice check below. */
const outputs: string[] = [];
function seen<T>(value: T): T {
  const walk = (entry: unknown): void => {
    if (typeof entry === 'string') outputs.push(entry);
    else if (Array.isArray(entry)) entry.forEach(walk);
    else if (entry && typeof entry === 'object') Object.values(entry).forEach(walk);
  };
  walk(value);
  return value;
}

describe('counts and the start action (§2.1, §2.2; UI-D3)', () => {
  it('writes counts out with their noun, singular or plural', () => {
    expect(pluralise(1, 'proposal', 'proposals')).toBe('1 proposal');
    expect(pluralise(1_200, 'proposal', 'proposals')).toBe('1,200 proposals');
    expect(seen(panelStatusLine(0))).toBe('No open AI proposals');
    expect(seen(panelStatusLine(1))).toBe('1 open proposal');
    expect(seen(panelStatusLine(3))).toBe('3 open proposals');
  });

  it('labels the start action by the field and whether any question is answered', () => {
    expect(seen(startActionLabel({ instruction: '', anyAnswered: false }))).toBe('Suggest more questions');
    expect(seen(startActionLabel({ instruction: '  ', anyAnswered: true }))).toBe('Suggest follow-up questions');
    expect(seen(startActionLabel({ instruction: 'Cover backups', anyAnswered: true }))).toBe('Ask the AI');
  });
});

describe('guidance and actions by questionnaire state (§2.4; D-06, D-07)', () => {
  it('gives each state its line, and the form-open line in analyst review', () => {
    expect(panelGuidance('analyst-review', { formOpen: false })).toBeNull();
    expect(seen(panelGuidance('analyst-review', { formOpen: true }))).toEqual({ icon: null, line: 'Save or discard the open question before you confirm proposals or ask the AI.', offerReturnToReview: false });
    expect(seen(panelGuidance('awaiting-submission', { formOpen: false }))).toEqual({
      icon: 'Clock', line: 'The Requestor is answering this questionnaire. You can ask the AI once they submit it, or after you return it to analyst review.', offerReturnToReview: true,
    });
    expect(seen(panelGuidance('submitted', { formOpen: false }))).toEqual({
      icon: 'Lock', line: 'To confirm proposals, return the questionnaire to analyst review. You can ask the AI and reject proposals now.', offerReturnToReview: true,
    });
    expect(seen(panelGuidance('draft-in-progress', { formOpen: false }))).toEqual({ icon: 'Lock', line: 'An assessment draft is being generated, so this questionnaire can’t change.', offerReturnToReview: false });
    expect(seen(panelGuidance('assessment-started', { formOpen: true }))).toEqual({ icon: 'Lock', line: 'An assessment has been drafted from this questionnaire, so its questions can no longer change.', offerReturnToReview: false });
  });

  it('offers Confirm, Edit then confirm and Reject on an open, current item in analyst review', () => {
    expect(itemActionsFor(openAdd, view, { formOpen: false })).toEqual({ confirm: 'enabled', editThenConfirm: 'enabled', reject: true, undo: false });
  });

  it('disables Confirm and Edit then confirm while a question form is open, and keeps Reject (UI-D10)', () => {
    expect(itemActionsFor(openAdd, view, { formOpen: true })).toEqual({ confirm: 'disabled', editThenConfirm: 'disabled', reject: true, undo: false });
  });

  it('offers Reject alone on a stale item and while the Requestor answers or has submitted', () => {
    const rejectOnly = { confirm: 'hidden', editThenConfirm: 'hidden', reject: true, undo: false };
    expect(itemActionsFor({ ...openAdd, stale: true }, view, { formOpen: false })).toEqual(rejectOnly);
    expect(itemActionsFor({ ...openAdd, stale: null }, withState('awaiting-submission'), { formOpen: false })).toEqual(rejectOnly);
    expect(itemActionsFor(openAdd, withState('submitted'), { formOpen: false })).toEqual(rejectOnly);
  });

  it('offers nothing once the draft started, and nothing the server does not allow', () => {
    const none = { confirm: 'hidden', editThenConfirm: 'hidden', reject: false, undo: false };
    expect(itemActionsFor(openAdd, withState('draft-in-progress'), { formOpen: false })).toEqual(none);
    expect(itemActionsFor(openAdd, withState('assessment-started'), { formOpen: false })).toEqual(none);
    const refused = { ...view, actions: { ...view.actions, confirm: { allowed: false, reason: 'OWN_REQUEST' }, reject: { allowed: false, reason: 'OWN_REQUEST' } } };
    expect(itemActionsFor(openAdd, refused, { formOpen: false })).toEqual(none);
  });

  it('offers Undo on a confirmed item in analyst review and on a rejected one until the draft (D-23)', () => {
    const undoOnly = { confirm: 'hidden', editThenConfirm: 'hidden', reject: false, undo: true };
    expect(itemActionsFor(confirmedChange, view, { formOpen: false })).toEqual(undoOnly);
    expect(itemActionsFor(confirmedChange, withState('submitted'), { formOpen: false }).undo).toBe(false);
    const rejected = { ...confirmedChange, state: 'rejected' as const, decision: { ...confirmedChange.decision!, action: 'rejected' as const } };
    expect(itemActionsFor(rejected, withState('submitted'), { formOpen: false }).undo).toBe(true);
    expect(itemActionsFor(rejected, withState('draft-in-progress'), { formOpen: false }).undo).toBe(false);
    expect(itemActionsFor({ ...rejected, canUndo: false }, view, { formOpen: false }).undo).toBe(false);
  });
});

describe('groups by request (§4.1)', () => {
  it('heads a group by who asked and what, with the instruction in typographic quotes', () => {
    expect(seen(runGroupHeading(run, 'Morgan Analyst', true))).toBe('Morgan Analyst asked the AI: “Ask about payment file signing.”');
    const defaultTask = { ...run, instruction: null, instructionSource: 'default-task' as const };
    expect(seen(runGroupHeading(defaultTask, 'Morgan Analyst', true))).toBe('Morgan Analyst asked the AI for follow-up questions');
    expect(seen(runGroupHeading(defaultTask, 'Morgan Analyst', false))).toBe('Morgan Analyst asked the AI for more questions');
    const rewrite = { ...run, operation: 'question-rewrite' as const, scope: 'question' as const, instruction: null, instructionSource: 'plain-language-preset' as const };
    expect(seen(runGroupHeading(rewrite, 'Morgan Analyst', true))).toBe('Morgan Analyst asked the AI to rewrite a question in plain language');
    expect(seen(runGroupHeading({ ...rewrite, instruction: 'Shorter, please.', instructionSource: 'analyst' }, 'Morgan Analyst', true))).toBe('Morgan Analyst asked the AI to rewrite a question: “Shorter, please.”');
  });

  it('lists the facts with the middle dot', () => {
    expect(seen(runFactsLine(run, '12 Oct 2026, 11:00 am'))).toBe('12 Oct 2026, 11:00 am · Provider: deterministic-questionnaire-proposals · Model: 1 · 1 of 2 open');
    expect(runFactsLine({ ...run, providerName: null, providerVersion: null }, '12 Oct 2026, 11:00 am')).toBe('12 Oct 2026, 11:00 am · 1 of 2 open');
  });

  it('maps every left-out code, leaves out the two internal ones and aggregates by count', () => {
    const lines = seen(leftOutLines([
      { code: 'answered-target', count: 1 },
      { code: 'removed-target', count: 2 },
      { code: 'unknown-target', count: 1 },
      { code: 'duplicate-target', count: 1 },
      { code: 'invalid-item', count: 1 },
      { code: 'near-duplicate', count: 3 },
      { code: 'no-change', count: 1 },
      { code: 'definition-invalid', count: 1 },
      { code: 'answers-affected', count: 1 },
      { code: 'rewrite-out-of-scope', count: 1 },
      { code: 'over-limit', count: 10 },
      { code: 'ignored-field', count: 4 },
      { code: 'sources-dropped', count: 2 },
      { code: 'something-new', count: 1 },
    ]));
    expect(lines).toEqual([
      'A change to an answered question. Answered questions stay as they are.',
      '2 × A change to a question that has been removed.',
      'A change to a question CSRM couldn’t find.',
      'A second proposal for the same question.',
      'A proposal that was incomplete or too long.',
      '3 × A question too close to one already asked, proposed, rejected or removed.',
      'A change that left the question as it was.',
      'A proposal that would have made the questionnaire inconsistent.',
      'A proposal that would have changed or hidden an answered question.',
      'A rewrite that changed more than the wording.',
      '10 more proposals beyond the limit of 30, or 15 new questions, per request.',
      'A proposal CSRM couldn’t use.',
    ]);
    expect(leftOutLines([{ code: 'over-limit', count: 1 }])).toEqual(['1 more proposal beyond the limit of 30, or 15 new questions, per request.']);
    expect(leftOutCount([{ code: 'over-limit', count: 10 }, { code: 'ignored-field', count: 4 }, { code: 'answered-target', count: 1 }])).toBe(11);
    expect(seen(leftOutLabel(11))).toBe('11 left out');
    expect(leftOutLabel(0)).toBeNull();
  });

  it('says how many cited sources could not be matched', () => {
    expect(unmatchedSourcesCaption(0)).toBeNull();
    expect(seen(unmatchedSourcesCaption(1))).toBe('1 source the AI cited couldn’t be matched, so it isn’t shown.');
    expect(seen(unmatchedSourcesCaption(2))).toBe('2 sources the AI cited couldn’t be matched, so they aren’t shown.');
  });
});

describe('the item card (§4.2 to §4.4)', () => {
  it('names each kind in its eyebrow, and a rewrite without an instruction as a plain-language rewrite', () => {
    expect(seen(itemEyebrow(openAdd, run))).toEqual({ label: 'New question', icon: 'Plus' });
    expect(seen(itemEyebrow(confirmedChange, run))).toEqual({ label: 'Question change', icon: 'PenLine' });
    expect(seen(itemEyebrow({ ...confirmedChange, kind: 'remove' }, run))).toEqual({ label: 'Question removal', icon: 'CircleMinus' });
    const preset = { ...run, operation: 'question-rewrite' as const, scope: 'question' as const, instruction: null, instructionSource: 'plain-language-preset' as const };
    expect(seen(itemEyebrow(confirmedChange, preset))).toEqual({ label: 'Plain-language rewrite', icon: 'PenLine' });
    expect(itemEyebrow(confirmedChange, { ...preset, instruction: 'Shorter.', instructionSource: 'analyst' })).toEqual({ label: 'Question change', icon: 'PenLine' });
  });

  it('takes the subject from the proposed question for an addition and the current one otherwise', () => {
    expect(itemSubject(openAdd)).toBe('Are payment files signed before upload?');
    expect(itemSubject(confirmedChange)).toBe('Where is data stored?');
  });

  it('says where a new question goes and when it shows', () => {
    expect(seen(placementLine(openAdd))).toBe('At the end of Payment processing');
    expect(seen(placementLine({ ...openAdd, placement: { sectionTitle: 'Offshore support', newSection: true, visibility: null } }))).toBe('In a new section, Offshore support, after the last section');
    expect(placementLine(confirmedChange)).toBeNull();
    const rule = (operator: 'equals' | 'notEquals' | 'includes' | 'notIncludes', value: string | boolean) => visibilityLine({ sectionTitle: 'S', newSection: false, visibility: { controllerText: 'Do you process payments?', operator, value } });
    expect(seen(rule('equals', true))).toBe('“Do you process payments?” is “Yes”');
    expect(seen(rule('notEquals', 'au'))).toBe('“Do you process payments?” is not “au”');
    expect(seen(rule('includes', 'cards'))).toBe('“Do you process payments?” includes “cards”');
    expect(seen(rule('notIncludes', false))).toBe('“Do you process payments?” doesn’t include “No”');
    expect(visibilityLine({ sectionTitle: 'S', newSection: false, visibility: null })).toBeNull();
    expect(seen(visibilityLine({ sectionTitle: 'S', newSection: false, visibility: { controllerText: null, operator: 'equals', value: 'yes' } }))).toBe('An earlier question is “yes”');
  });

  it('labels each citation by its source', () => {
    const [instruction, note] = openAdd.sources;
    expect(seen(citationLabel(instruction!, ''))).toBe('Instruction');
    expect(seen(citationLabel(note!, '11 Oct 2026, 11:00 am'))).toBe('Note: Security Analyst note · 11 Oct 2026, 11:00 am');
    expect(seen(citationLabel({ ...note!, note: { ...note!.note!, part: 'requestor' } }, '11 Oct'))).toBe('Note: Requestor note · 11 Oct');
    expect(seen(citationLabel({ kind: 'request-field', ref: 'request.description', label: 'Description', note: null }, ''))).toBe('Request: Description');
    expect(seen(citationLabel({ kind: 'file', ref: 'file.1', label: 'Vendor pack.pdf', note: null }, ''))).toBe('File: Vendor pack.pdf');
    expect(seen(citationLabel({ kind: 'answered-question', ref: 'answer.q', label: 'Who owns it?', note: null }, ''))).toBe('Answered question: Who owns it?');
  });

  it('explains a stale item by its kind', () => {
    expect(staleLine(openAdd)).toBeNull();
    expect(seen(staleLine({ ...openAdd, stale: true }))).toBe('The questionnaire has changed since the AI proposed this, so it can’t be added as proposed. Reject it, or add the question yourself.');
    expect(seen(staleLine({ ...confirmedChange, state: 'open', stale: true }))).toBe('This question has changed, been answered or been removed since the AI proposed this, so it can’t be confirmed. Reject it, or ask the AI again.');
  });
});

describe('decided proposals (§4.6)', () => {
  const at = '12 Oct 2026, 11:10 am';
  const decided = (action: 'accepted' | 'rejected' | 'superseded' | 'lapsed', extra: Partial<NonNullable<QuestionnaireAiItemView['decision']>> = {}): QuestionnaireAiItemView => ({
    ...confirmedChange, state: action === 'accepted' ? 'accepted' : action, decision: { ...confirmedChange.decision!, action, edited: false, ...extra },
  });

  it('gives the five notes', () => {
    expect(seen(decidedNote(decided('accepted'), { deciderName: 'Morgan Analyst', instant: at }))).toEqual({ icon: 'Check', text: `Confirmed · Morgan Analyst · ${at}`, reason: null });
    expect(seen(decidedNote(decided('accepted', { edited: true }), { deciderName: 'Morgan Analyst', instant: at }))).toEqual({ icon: 'PenLine', text: `Edited, then confirmed · Morgan Analyst · ${at}`, reason: null });
    expect(seen(decidedNote(decided('rejected', { reason: 'Already covered.' }), { deciderName: 'Morgan Analyst', instant: at }))).toEqual({ icon: 'X', text: `Rejected · Morgan Analyst · ${at}`, reason: 'Reason: “Already covered.”' });
    expect(seen(decidedNote(decided('superseded'), { deciderName: 'Sam Analyst', instant: at }))).toEqual({ icon: 'ListRestart', text: `Replaced by a newer proposal · Sam Analyst · ${at}`, reason: null });
    expect(seen(decidedNote(decided('lapsed'), { deciderName: null, instant: at }))).toEqual({ icon: 'Lock', text: 'Closed without a decision: an assessment draft froze the questionnaire.', reason: null });
    expect(decidedNote(openAdd, { deciderName: null, instant: at })).toBeNull();
  });

  it('captions who asked and when', () => {
    expect(seen(proposedCaption('12 Oct 2026, 11:00 am', 'Morgan Analyst'))).toBe('Proposed 12 Oct 2026, 11:00 am at Morgan Analyst’s request');
  });
});

describe('decision toasts (§5.1)', () => {
  it('words each success and Undo', () => {
    expect(seen(decisionToast('confirm', { kind: 'add', sectionTitle: 'Payment processing' }))).toBe('New question confirmed and added to Payment processing.');
    expect(seen(decisionToast('confirm', { kind: 'add', sectionTitle: 'Payment processing', edited: true }))).toBe('New question confirmed and added to Payment processing with your edits.');
    expect(seen(decisionToast('confirm', { kind: 'change' }))).toBe('Question change confirmed.');
    expect(seen(decisionToast('confirm', { kind: 'change', edited: true }))).toBe('Question change confirmed with your edits.');
    expect(seen(decisionToast('confirm', { kind: 'remove' }))).toBe('Question removed.');
    expect(seen(decisionToast('reject', {}))).toBe('Proposal rejected.');
    expect(seen(decisionToast('reject-remaining', { count: 1 }))).toBe('1 proposal rejected.');
    expect(seen(decisionToast('reject-remaining', { count: 4 }))).toBe('4 proposals rejected.');
    expect(seen(decisionToast('undo-confirm', { kind: 'add' }))).toBe('Confirmation undone. The question was taken out again.');
    expect(seen(decisionToast('undo-confirm', { kind: 'change' }))).toBe('Confirmation undone. The question is back as it was.');
    expect(seen(decisionToast('undo-confirm', { kind: 'remove' }))).toBe('Confirmation undone. The question is back.');
    expect(seen(decisionToast('undo-reject', {}))).toBe('Rejection undone. The proposal is open again.');
    expect(seen(decisionToast('undo-reject-remaining', {}))).toBe('Rejections undone.');
  });

  it('titles each failure', () => {
    expect(seen(decisionFailureTitle('confirm'))).toBe('Proposal not confirmed');
    expect(seen(decisionFailureTitle('reject'))).toBe('Proposal not rejected');
    expect(seen(decisionFailureTitle('reject-remaining'))).toBe('Proposals not rejected');
    expect(seen(decisionFailureTitle('undo-confirm'))).toBe('Couldn’t undo');
    expect(seen(decisionFailureTitle('undo-reject'))).toBe('Couldn’t undo');
  });
});

describe('the instruction field, the answered list and the empty states (§2.5, §3.1, §7.2)', () => {
  it('counts the instruction once it holds text, and refuses one over 500', () => {
    expect(instructionCountLine(0)).toBeNull();
    expect(seen(instructionCountLine(12))).toBe('12 of 500 characters');
    expect(instructionTooLongLine(500)).toBeNull();
    expect(seen(instructionTooLongLine(512))).toBe('Keep the instruction to 500 characters or fewer. It has 512.');
  });

  it('toggles the answered questions only when there are some', () => {
    expect(fixedQuestionsToggle(0)).toBeNull();
    expect(seen(fixedQuestionsToggle(1))).toBe('1 answered question stays as it is');
    expect(seen(fixedQuestionsToggle(3))).toBe('3 answered questions stay as they are');
  });

  it('gives the first-use and cleared empty states, and none when the start is not offered', () => {
    const empty = { ...view, items: [], runs: [], openCount: 0 };
    expect(seen(emptyState(empty))).toEqual({ title: 'No AI proposals yet', body: 'Ask the AI for follow-up questions, or give it an instruction such as “Add questions about the offshore support team”.' });
    expect(emptyState({ ...empty, actions: { ...view.actions, start: { allowed: false, reason: 'QUESTIONNAIRE_NOT_SUBMITTED' } } })).toBeNull();
    expect(seen(emptyState({ ...view, items: [confirmedChange], openCount: 0 }))).toEqual({ title: 'No open AI proposals', body: 'Every proposal has been decided. They’re listed under Decided proposals.' });
    expect(emptyState(view)).toBeNull();
  });
});

describe('gates and the hub (§8)', () => {
  it('replaces Release with a line while proposals are open or a job is active (§8.1)', () => {
    expect(releaseGateLine({ openCount: 0, activeJob: false, countServed: true })).toBeNull();
    expect(seen(releaseGateLine({ openCount: 1, activeJob: false, countServed: true }))).toEqual({
      text: 'Decide the 1 open AI proposal before you release this questionnaire.', link: { label: '1 open AI proposal', href: '#ai-proposals' },
    });
    expect(seen(releaseGateLine({ openCount: 3, activeJob: true, countServed: true }))?.text).toBe('Decide the 3 open AI proposals before you release this questionnaire.');
    expect(seen(releaseGateLine({ openCount: 0, activeJob: true, countServed: true }))).toEqual({
      text: 'The AI is preparing proposals. Decide them before you release this questionnaire.', link: { label: 'Go to AI proposals', href: '#ai-proposals' },
    });
    expect(seen(releaseGateLine({ openCount: 0, activeJob: false, countServed: false }))).toEqual({
      text: 'This questionnaire has open AI proposals. Another Security Analyst decides them before release.', link: null,
    });
  });

  it('replaces Generate assessment draft with a line while proposals are open (§8.2)', () => {
    expect(draftGateLine(0, 'questionnaire-1')).toBeNull();
    expect(seen(draftGateLine(2, 'questionnaire 1'))).toEqual({
      text: 'Decide the 2 open AI proposals on the questionnaire before you generate the draft.',
      link: { label: '2 open AI proposals', href: '/app/review/questionnaires/questionnaire%201#ai-proposals' },
    });
  });

  it('offers Replace, or says why not, from the served replace action (§8.3)', () => {
    const replace = (reason: string | null, allowed = false) => replaceOffer({ ...view, actions: { ...view.actions, replace: { allowed, reason } } });
    expect(replace(null, true)).toEqual({ offered: true });
    expect(seen(replace('QUESTIONNAIRE_ANSWERED'))).toEqual({
      offered: false, line: 'The Requestor has answered this questionnaire, so it can’t be replaced. Ask the AI for follow-up questions instead.', link: { label: 'Open AI proposals', href: '#ai-proposals' },
    });
    expect(seen(replace('QUESTIONNAIRE_HAS_ANALYST_CHANGES'))).toEqual({
      offered: false, line: 'Analysts have changed this questionnaire since it was generated, so replacing it would discard their work. Use AI proposals to change it instead.', link: { label: 'Open AI proposals', href: '#ai-proposals' },
    });
    expect(seen(replace('AI_PROPOSALS_OPEN'))).toEqual({
      offered: false, line: 'This questionnaire has open AI proposals. Decide them before replacing it.', link: { label: '1 open AI proposal', href: '#ai-proposals' },
    });
    expect(replace('QUESTIONNAIRE_RELEASED')).toEqual({ offered: false, line: null, link: null });
  });

  it('counts the hub’s AI proposals line (§8.4)', () => {
    expect(seen(hubProposalsLine(0))).toEqual({ text: 'AI proposals: none open', linked: false });
    expect(seen(hubProposalsLine(2))).toEqual({ text: 'AI proposals: 2 open', linked: true });
  });
});

describe('the voice (15-UI-SPEC “Voice”; UI-D1)', () => {
  it('never names the analyst’s review act with a reserved verb, in any string the module returns', () => {
    expect(outputs.length).toBeGreaterThan(60);
    for (const text of outputs) expect(text).not.toMatch(/\b(accept|approve|dismiss)/i);
  });

  it('is zod-free, with no directive', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/questionnaire-ai/questionnaire-ai-domain.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]zod['"]/);
    expect(source).not.toMatch(/^['"]use (client|server)['"]/m);
  });
});
