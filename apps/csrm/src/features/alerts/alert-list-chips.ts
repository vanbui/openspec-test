import 'server-only';

import type { DataTableFilter } from '@/components/csrm/data-table';

import type { AlertKind, AlertUrgency } from './alert-domain';
import { alertKindLabels, alertUrgencyLabels } from './alert-presentation';

/**
 * The Alerts list's filter chips (UI-SPEC §3.2): the alert type and the urgency by their labels. Server-only, for the
 * header's Export (Phase 19 X-30): the list keeps its own chips, and list-export-placement.test.tsx renders it and
 * proves its chips equal these.
 */
export function alertFilterChips(query: { kind?: AlertKind; urgency?: AlertUrgency }): DataTableFilter[] {
  return [
    ...(query.kind ? [{ id: 'kind', label: 'Alert type', value: alertKindLabels[query.kind] }] : []),
    ...(query.urgency ? [{ id: 'urgency', label: 'Urgency', value: alertUrgencyLabels[query.urgency] }] : []),
  ];
}
