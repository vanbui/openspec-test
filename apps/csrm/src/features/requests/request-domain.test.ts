import { describe, expect, it } from 'vitest';

import { analystRequestLifecycle, offersQuestionnaireGeneration, requestStatuses, type RequestLifecycle, type RequestStatus } from './request-domain';

/*
 * Walkthrough fix 4 (UX-06): a Next action line never names an action the page does not offer. Strapi serves
 * the Submitted step, "Generate the questionnaire.", for any request past draft that holds no questionnaire,
 * while it generates only for a submitted request. The Phase 7 fixtures RAR-E2E-P7-OVERDUE-001 (under review)
 * and RAR-E2E-P7-DUESOON-001 (questionnaire in progress) are that shape.
 */
const submittedStep = (actor: 'analyst' | 'requestor' = 'analyst'): RequestLifecycle => ({
  currentKey: 'submitted',
  currentLabel: 'Submitted',
  terminal: false,
  nextAction: actor === 'analyst'
    ? { actor, summary: 'Generate the questionnaire.', href: '/app/review/requests/request-1' }
    : { actor, summary: 'The work is waiting with the other party.' },
  steps: [],
});

describe('the analyst’s next action follows the generation rule (walkthrough fix 4)', () => {
  it('offers questionnaire generation only for a submitted request', () => {
    expect(requestStatuses.filter((requestStatus) => offersQuestionnaireGeneration({ requestStatus }))).toEqual(['submitted']);
  });

  it('keeps Generate the questionnaire. for a submitted request', () => {
    const lifecycle = submittedStep();
    expect(analystRequestLifecycle({ requestStatus: 'submitted', lifecycle })).toBe(lifecycle);
  });

  it.each<RequestStatus>(['under-review', 'questionnaire-in-progress', 'risk-assessment-drafted'])(
    'names no action for a %s request served the Submitted step, and keeps its steps',
    (requestStatus) => {
      const lifecycle = { ...submittedStep(), steps: [{ key: 'submitted' as const, label: 'Submitted', state: 'current' as const }] };
      const shown = analystRequestLifecycle({ requestStatus, lifecycle });
      expect(shown?.nextAction).toBeNull();
      expect(shown?.steps).toBe(lifecycle.steps);
      expect(shown?.currentKey).toBe('submitted');
    },
  );

  it('leaves every other served next action as served', () => {
    const released: RequestLifecycle = {
      currentKey: 'questionnaire-released', currentLabel: 'Questionnaire released', terminal: false,
      nextAction: { actor: 'analyst', summary: 'The work is waiting with the other party.' }, steps: [],
    };
    expect(analystRequestLifecycle({ requestStatus: 'questionnaire-in-progress', lifecycle: released })).toBe(released);
    expect(analystRequestLifecycle({ requestStatus: 'under-review', lifecycle: submittedStep('requestor') })?.nextAction?.summary).toBe('The work is waiting with the other party.');
  });

  it('passes a lifecycle with no next action, or none at all, through', () => {
    expect(analystRequestLifecycle({ requestStatus: 'under-review', lifecycle: undefined })).toBeUndefined();
    const terminal = { ...submittedStep(), terminal: true, nextAction: null };
    expect(analystRequestLifecycle({ requestStatus: 'closed', lifecycle: terminal })).toBe(terminal);
  });
});
