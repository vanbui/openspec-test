import { statusLabel } from '@/components/csrm/status-badge';

import {
  riskRegisterEffectivenessLabels,
  riskRegisterMitigationStatusLabels,
  riskRegisterRatingFilterLabel,
  riskRegisterStageLabels,
  riskRegisterStateLabels,
  riskRegisterTreatmentStatusNoneLabel,
  riskTreatmentDueStateLabels,
} from './risk-domain';
import type { RiskRegisterQuery } from './risk-schema';

/*
 * The Risk register's active filter chips: the search and each filter with the words the table's chips show (UI-SPEC
 * §9.5). Plain TypeScript with no directive and no zod, so the register table (a client component) and the register
 * page (a server component, which hands them to the header's Export, X-30) read the same chips.
 */

export type RiskRegisterFilterChip = { readonly id: string; readonly label: string; readonly value: string };

/** The relation filters a chip names by a record's label. */
export type RiskRegisterRelationFilter = 'riskOwner' | 'treatmentOwner' | 'assessment' | 'system' | 'asset';

/** A treatment status filter's words: the shared status mapping, and Not provided for none (UI-SPEC §9.5). */
export function treatmentStatusFilterLabel(value: NonNullable<RiskRegisterQuery['treatmentStatus']>): string {
  return value === 'none' ? riskRegisterTreatmentStatusNoneLabel : statusLabel('treatment', value);
}

/** The chips for a parsed query, in the table's order: the search first, then each active filter. */
export function riskRegisterFilterChips(
  query: Partial<RiskRegisterQuery>,
  labelFor: (key: RiskRegisterRelationFilter) => string,
): RiskRegisterFilterChip[] {
  return [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    ...(query.treatmentStatus ? [{ id: 'treatmentStatus', label: 'Treatment status', value: treatmentStatusFilterLabel(query.treatmentStatus) }] : []),
    ...(query.inherentRating ? [{ id: 'inherentRating', label: 'Inherent rating', value: riskRegisterRatingFilterLabel(query.inherentRating) }] : []),
    ...(query.residualRating ? [{ id: 'residualRating', label: 'Residual rating', value: riskRegisterRatingFilterLabel(query.residualRating) }] : []),
    ...(query.riskOwner ? [{ id: 'riskOwner', label: 'Risk owner', value: labelFor('riskOwner') }] : []),
    ...(query.treatmentOwner ? [{ id: 'treatmentOwner', label: 'Treatment owner', value: labelFor('treatmentOwner') }] : []),
    ...(query.assessment ? [{ id: 'assessment', label: 'Related assessment', value: labelFor('assessment') }] : []),
    ...(query.system ? [{ id: 'system', label: 'Impacted system', value: labelFor('system') }] : []),
    ...(query.impactedSystem ? [{ id: 'impactedSystem', label: 'Impacted system', value: 'None' }] : []),
    ...(query.asset ? [{ id: 'asset', label: 'Impacted asset', value: labelFor('asset') }] : []),
    ...(query.mitigationStatus ? [{ id: 'mitigationStatus', label: 'Mitigation-control status', value: riskRegisterMitigationStatusLabels[query.mitigationStatus] }] : []),
    ...(query.state ? [{ id: 'state', label: 'Risk state', value: riskRegisterStateLabels[query.state] }] : []),
    ...(query.stage ? [{ id: 'stage', label: 'Stage', value: riskRegisterStageLabels[query.stage] }] : []),
    ...(query.treatmentAction ? [{ id: 'treatmentAction', label: 'Treatment action', value: query.treatmentAction }] : []),
    ...(query.dueState ? [{ id: 'dueState', label: 'Due state', value: riskTreatmentDueStateLabels[query.dueState] }] : []),
    ...(query.mitigationEffectiveness ? [{ id: 'mitigationEffectiveness', label: 'Mitigation-control effectiveness', value: riskRegisterEffectivenessLabels[query.mitigationEffectiveness] }] : []),
    ...(query.targetDateFrom ? [{ id: 'targetDateFrom', label: 'Target date from', value: query.targetDateFrom }] : []),
    ...(query.targetDateTo ? [{ id: 'targetDateTo', label: 'Target date to', value: query.targetDateTo }] : []),
  ];
}
