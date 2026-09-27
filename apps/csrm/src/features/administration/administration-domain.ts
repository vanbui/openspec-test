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
