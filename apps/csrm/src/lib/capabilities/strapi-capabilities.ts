import 'server-only';

import { getCurrentUserAccess } from '@/features/access/access-service';
import { capabilities, type Capability } from './capability-adapter';

/*
 * Each web capability is anchored to the FunctionApi operations its screens depend
 * on (docs/adr/0004), each one a served operation those screens' services call. A
 * capability is held only when Strapi reports every anchor as
 * granted, so a partial grant never opens a screen whose first call would be refused.
 * This is presentation only: Strapi still authorises every call (AGENTS.md).
 */
export const capabilityAnchors: Readonly<Record<Capability, readonly string[]>> = {
  'assessment-request:read': ['GET:/api/csrm-assessment-requests'],
  'assessment-request:create': ['POST:/api/csrm-assessment-requests'],
  'assessment:review': ['GET:/api/v1/assessment_requests'],
  'risk:manage': ['GET:/api/v1/risks'],
  'administration:manage': [
    'GET:/api/v1/risk_types',
    'GET:/api/v1/controls',
    'GET:/api/v1/information_systems',
    'GET:/api/v1/information_assets',
  ],
};

export function capabilitiesFromOperations(operations: readonly string[]): ReadonlySet<Capability> {
  const granted = new Set(operations);
  return new Set(capabilities.filter((capability) => capabilityAnchors[capability].every((operation) => granted.has(operation))));
}

/** Any transport or contract failure grants nothing (fail closed). */
export async function strapiGrantedCapabilities(): Promise<ReadonlySet<Capability>> {
  const result = await getCurrentUserAccess();
  return result.error ? new Set() : capabilitiesFromOperations(result.data.operations);
}
