import 'server-only';
import type { Capability, CapabilityAdapter } from './capability-adapter';
import type { DevelopmentRole } from '@/lib/auth/session-adapter';

const grants: Record<DevelopmentRole, readonly Capability[]> = {
  Requestor: ['assessment-request:create','assessment-request:read'],
  'Secondary Requestor': ['assessment-request:create','assessment-request:read'],
  'Security Analyst': ['assessment-request:create','assessment-request:read','assessment:review','risk:manage','administration:manage'],
};
export class DevelopmentCapabilityAdapter implements CapabilityAdapter { constructor(private readonly role: DevelopmentRole) {} async granted() { return new Set<Capability>(grants[this.role]); } }
