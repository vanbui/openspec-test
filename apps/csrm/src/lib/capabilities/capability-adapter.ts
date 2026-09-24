export const capabilities = ['assessment-request:create','assessment-request:read','assessment:review','risk:manage','administration:manage'] as const;
export type Capability = (typeof capabilities)[number];
export interface CapabilityAdapter { granted(): Promise<ReadonlySet<Capability>>; }
export function can(capability: Capability, granted: ReadonlySet<Capability>): boolean { return granted.has(capability); }
