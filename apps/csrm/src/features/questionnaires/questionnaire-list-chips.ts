import 'server-only';

import type { DataTableFilter } from '@/components/csrm/data-table';
import { statusLabel } from '@/components/csrm/status-badge';

import type { QuestionnaireListQuery } from './questionnaire-service';

/**
 * A questionnaire list's filter chips (My questionnaires and the analyst's Questionnaires): the search and the status
 * by the shared mapping. Server-only, for the headers' Export (Phase 19 X-30): both lists keep their own chips, and
 * list-export-placement.test.tsx renders each and proves its chips equal these.
 */
export function questionnaireFilterChips(query: Pick<QuestionnaireListQuery, 'q' | 'status'>): DataTableFilter[] {
  return [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    ...(query.status ? [{ id: 'status', label: 'Status', value: statusLabel('questionnaire', query.status) }] : []),
  ];
}
