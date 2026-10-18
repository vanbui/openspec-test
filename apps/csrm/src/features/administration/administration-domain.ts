/*
 * The Administration collections’ vocabularies, free of zod (plan 08-13, D-24). The collection lists
 * and the create and edit form read them in the browser from here, so a list page never downloads
 * the validation library; administration-schema.ts builds its query and input parsers on the same
 * values and re-exports them for server code.
 */
export const administrationPageSizes = [10, 25, 50, 100] as const;
export const riskTypeSortValues = ['name:asc', 'name:desc', 'updatedAt:asc', 'updatedAt:desc'] as const;
export const controlSortValues = ['controlNumber:asc', 'controlNumber:desc', 'name:asc', 'name:desc', 'updatedAt:asc', 'updatedAt:desc'] as const;
export const controlTypeValues = ['Preventive', 'Detective', 'Corrective', 'Compensating'] as const;
export const systemEnvironmentValues = ['Production', 'Non-production'] as const;
export const deploymentModelValues = ['On-prem', 'Cloud', 'SaaS'] as const;
export const lifecycleStateValues = ['New', 'Changed', 'Existing', 'Decommissioning'] as const;
export const dataClassificationValues = ['Public', 'Internal', 'Restricted', 'Critical Infrastructure Sensitive'] as const;
export const systemSortValues = ['name:asc', 'name:desc', 'systemType:asc', 'systemType:desc', 'environment:asc', 'environment:desc', 'lifecycleState:asc', 'lifecycleState:desc', 'updatedAt:asc', 'updatedAt:desc'] as const;
export const assetSortValues = ['name:asc', 'name:desc', 'dataClassification:asc', 'dataClassification:desc', 'type:asc', 'type:desc', 'updatedAt:asc', 'updatedAt:desc'] as const;

/** A reference list's query, as far as its filter chips read it. */
type AdministrationChipQuery = Partial<Record<'q' | 'framework' | 'controlType' | 'environment' | 'deploymentModel' | 'lifecycleState' | 'internetFacing' | 'dataClassification' | 'containsPersonalData' | 'containsLegalData' | 'containsCreditCardData', string>>;

/**
 * The list's active search and filters as chips (`{ id, label, value }`), in the list's order: the table's chips, and
 * the reference-list export's scope lines (19-15), from one definition.
 */
export function administrationFilterChips(query: AdministrationChipQuery): { id: string; label: string; value: string }[] {
  const yesNo = (value: string) => (value === 'true' ? 'Yes' : 'No');
  return [
    ...(query.q ? [{ id: 'q', label: 'Search', value: query.q }] : []),
    ...(query.framework ? [{ id: 'framework', label: 'Framework', value: query.framework }] : []),
    ...(query.controlType ? [{ id: 'controlType', label: 'Control type', value: query.controlType }] : []),
    ...(query.environment ? [{ id: 'environment', label: 'Environment', value: query.environment }] : []),
    ...(query.deploymentModel ? [{ id: 'deploymentModel', label: 'Deployment model', value: query.deploymentModel }] : []),
    ...(query.lifecycleState ? [{ id: 'lifecycleState', label: 'Lifecycle', value: query.lifecycleState }] : []),
    ...(query.internetFacing ? [{ id: 'internetFacing', label: 'Internet-facing', value: yesNo(query.internetFacing) }] : []),
    ...(query.dataClassification ? [{ id: 'dataClassification', label: 'Classification', value: query.dataClassification }] : []),
    ...(['containsPersonalData', 'containsLegalData', 'containsCreditCardData'] as const).flatMap((field) => {
      const value = query[field];
      return value ? [{ id: field, label: field === 'containsPersonalData' ? 'Personal data' : field === 'containsLegalData' ? 'Legal data' : 'Credit-card data', value: yesNo(value) }] : [];
    }),
  ];
}
