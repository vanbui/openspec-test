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
  // My requests and the Requestor Home read the caller's own requests through GET /v1/my_requests (11-11, 11-12),
  // which the Requestor birthright's My Requests Function grants; the web no longer calls the core list.
  'assessment-request:read': ['GET:/api/v1/my_requests'],
  'assessment-request:create': ['POST:/api/csrm-assessment-requests'],
  'assessment:review': ['GET:/api/v1/assessment_requests'],
  'risk:manage': ['GET:/api/v1/risks'],
  'administration:manage': [
    'GET:/api/v1/risk_types',
    'GET:/api/v1/controls',
    'GET:/api/v1/information_systems',
    'GET:/api/v1/information_assets',
  ],
  // Phase 19 (19-06): Export on the Risk register. The export's catalogue URL, exactly as /v1/me/access reports it and
  // as its policy names it, with the list read the export requires (19-05 underlyingRead), so a partial grant never
  // shows an Export whose request would be refused.
  'risk-register:export': ['GET:/api/v1/risks', 'GET:/api/v1/risks/export?format={format}'],
  // Phase 19 (19-11): each export is its own Function grant, anchored to its list read and its export, never to the
  // read's capability alone. A report: the report read and the report export (the catalogue writes no query template).
  'reports:export': ['GET:/api/v1/reports/{reportKey}', 'POST:/api/v1/reports/{reportKey}/export'],
  'assessment-requests:export': ['GET:/api/v1/assessment_requests', 'GET:/api/v1/assessment_requests/export'],
  'my-requests:export': ['GET:/api/v1/my_requests', 'GET:/api/v1/my_requests/export'],
  'questionnaires:export': ['GET:/api/v1/questionnaires', 'GET:/api/v1/questionnaires/export'],
  'my-questionnaires:export': ['GET:/api/v1/my_questionnaires', 'GET:/api/v1/my_questionnaires/export'],
  'risk-assessments:export': ['GET:/api/v1/risk_assessments', 'GET:/api/v1/risk_assessments/export'],
  'my-risk-assessments:export': ['GET:/api/v1/my_risk_assessments', 'GET:/api/v1/my_risk_assessments/export'],
  'alerts:export': ['GET:/api/v1/alerts', 'GET:/api/v1/alerts/export'],
  // The released assessment's header actions (19-12): its export and every released read it discloses, the detail, the
  // risks and each Risk's control implementations, as Strapi's export policy requires them (BE2-01), granted to
  // role.requestor and role.security_analyst.
  'released-assessment:export': [
    'GET:/api/v1/risk_assessments/{assessmentId}',
    'GET:/api/v1/risk_assessments/{assessmentId}/risks',
    'GET:/api/v1/risks/{riskId}/control_implementations',
    'GET:/api/v1/risk_assessments/{assessmentId}/export',
  ],
  // Phase 19 (19-15, D-33): each reference list's Export, anchored to the collection's list read and its export's
  // catalogue URL (19-14, with its query template, as /v1/me/access reports it). administration:manage never decides it.
  'risk-types:export': ['GET:/api/v1/risk_types', 'GET:/api/v1/risk_types/export?format={format}'],
  'controls:export': ['GET:/api/v1/controls', 'GET:/api/v1/controls/export?format={format}'],
  'information-systems:export': ['GET:/api/v1/information_systems', 'GET:/api/v1/information_systems/export?format={format}'],
  'information-assets:export': ['GET:/api/v1/information_assets', 'GET:/api/v1/information_assets/export?format={format}'],
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
