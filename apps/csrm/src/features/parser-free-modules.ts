import type { ContractResponseParser } from './assessments/assessment-service';

/**
 * Modules the contract parity inventory must account for but which parse no
 * transport response themselves.
 *
 * These declarations used to live in the modules they describe. That is not
 * possible for a server-action module: a `'use server'` file may export only
 * async functions, and exporting this object from one broke every route that
 * imported it at runtime — while still passing the unit suite and both
 * typechecks, because nothing there renders a route.
 *
 * A statement that a module has no response parsers is a statement *about* the
 * module rather than part of it, so the registry is the right home regardless.
 */
export type ParserFreeModule = {
  readonly modulePath: string;
  readonly mode: 'no-direct-response-parser';
  readonly parsers: readonly ContractResponseParser[];
  readonly reason: string;
};

const delegatesTo = (service: string) =>
  `Server actions validate input and delegate successful transport response parsing to ${service}.`;

export const parserFreeModules: readonly ParserFreeModule[] = [
  {
    modulePath: 'features/requests/request-actions.ts',
    mode: 'no-direct-response-parser',
    parsers: [],
    reason: delegatesTo('request-service'),
  },
  {
    modulePath: 'features/questionnaires/questionnaire-actions.ts',
    mode: 'no-direct-response-parser',
    parsers: [],
    reason: delegatesTo('questionnaire-service'),
  },
  {
    modulePath: 'features/assessments/assessment-actions.ts',
    mode: 'no-direct-response-parser',
    parsers: [],
    reason: delegatesTo('assessment-service'),
  },
  {
    modulePath: 'features/administration/administration-actions.ts',
    mode: 'no-direct-response-parser',
    parsers: [],
    reason: delegatesTo('administration-service'),
  },
  {
    modulePath: 'features/risks/risk-actions.ts',
    mode: 'no-direct-response-parser',
    parsers: [],
    reason: 'Risk server actions validate input and delegate successful transport response parsing to risk-service.',
  },
  {
    modulePath: 'features/ai-assistance/ai-assistance-actions.ts',
    mode: 'no-direct-response-parser',
    parsers: [],
    reason: 'The AI run Server Action validates its input and delegates response parsing to ai-assistance-service.',
  },
  {
    modulePath: 'features/questionnaire-ai/questionnaire-ai-actions.ts',
    mode: 'no-direct-response-parser',
    parsers: [],
    reason: delegatesTo('questionnaire-ai-service'),
  },
  {
    modulePath: 'features/risk-curation/risk-curation-actions.ts',
    mode: 'no-direct-response-parser',
    parsers: [],
    reason: delegatesTo('risk-curation-service'),
  },
];
