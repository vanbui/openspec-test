export const capabilities = ['assessment-request:create','assessment-request:read','assessment:review','risk:manage','administration:manage','risk-register:export','reports:export','assessment-requests:export','my-requests:export','questionnaires:export','my-questionnaires:export','risk-assessments:export','my-risk-assessments:export','alerts:export','released-assessment:export','risk-types:export','controls:export','information-systems:export','information-assets:export'] as const;
export type Capability = (typeof capabilities)[number];
export interface CapabilityAdapter { granted(): Promise<ReadonlySet<Capability>>; }
export function can(capability: Capability, granted: ReadonlySet<Capability>): boolean { return granted.has(capability); }
