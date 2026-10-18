import 'server-only';
import type { Capability, CapabilityAdapter } from './capability-adapter';
import type { DevelopmentRole } from '@/lib/auth/session-adapter';

/*
 * Phase 19 (19-11): each export is held exactly as Strapi grants it. The Requestor birthright's exports (My requests,
 * My questionnaires, My risk assessments and the released assessment, granted to role.requestor) are every person's,
 * because the birthright is; the analyst exports are role.security_analyst's alone. The four reference-list exports
 * (19-15) are held as Strapi grants the Administration Functions: by the Security Analyst fixtures only.
 */
const requestorGrants: readonly Capability[] = ['assessment-request:create','assessment-request:read','my-requests:export','my-questionnaires:export','my-risk-assessments:export','released-assessment:export'];
const securityAnalystGrants: readonly Capability[] = [...requestorGrants,'assessment:review','risk:manage','administration:manage','risk-register:export','reports:export','assessment-requests:export','questionnaires:export','risk-assessments:export','alerts:export','risk-types:export','controls:export','information-systems:export','information-assets:export'];
const grants: Record<DevelopmentRole, readonly Capability[]> = {
  Requestor: requestorGrants,
  'Secondary Requestor': requestorGrants,
  'Security Analyst': securityAnalystGrants,
  // D-31: the second human Security Analyst holds exactly the Security Analyst grants.
  'Second Security Analyst': securityAnalystGrants,
};
export class DevelopmentCapabilityAdapter implements CapabilityAdapter { constructor(private readonly role: DevelopmentRole) {} async granted() { return new Set<Capability>(grants[this.role]); } }
