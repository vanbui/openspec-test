import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUserAccessMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/features/access/access-service', () => ({ getCurrentUserAccess: getCurrentUserAccessMock }));

import { capabilities } from './capability-adapter';
import { capabilityAnchors, capabilitiesFromOperations, strapiGrantedCapabilities } from './strapi-capabilities';

/** The catalogued operations the seeded Requestor birthright and Security Analyst hold. */
const requestorOperations = [
  'GET:/api/v1/me/access',
  'GET:/api/csrm-assessment-requests',
  'POST:/api/csrm-assessment-requests',
  'GET:/api/v1/my_requests',
  'GET:/api/v1/assessment_requests/{requestId}',
  'GET:/api/v1/my_requests/export',
  'GET:/api/v1/my_questionnaires',
  'GET:/api/v1/my_questionnaires/export',
  'GET:/api/v1/my_risk_assessments',
  'GET:/api/v1/my_risk_assessments/export',
  'GET:/api/v1/risk_assessments/{assessmentId}',
  'GET:/api/v1/risk_assessments/{assessmentId}/risks',
  'GET:/api/v1/risks/{riskId}/control_implementations',
  'GET:/api/v1/risk_assessments/{assessmentId}/export',
];
/* The capabilities the Requestor birthright's operations grant: the request screens and the four birthright exports. */
const requestorCapabilities = ['assessment-request:create', 'assessment-request:read', 'my-requests:export', 'my-questionnaires:export', 'my-risk-assessments:export', 'released-assessment:export'];
const analystOperations = [
  ...requestorOperations,
  'GET:/api/v1/assessment_requests',
  'GET:/api/v1/risks',
  'GET:/api/v1/risk_types',
  'GET:/api/v1/controls',
  'GET:/api/v1/information_systems',
  'GET:/api/v1/information_assets',
  'GET:/api/v1/risks/export?format={format}',
  'GET:/api/v1/reports/{reportKey}',
  'POST:/api/v1/reports/{reportKey}/export',
  'GET:/api/v1/assessment_requests/export',
  'GET:/api/v1/questionnaires',
  'GET:/api/v1/questionnaires/export',
  'GET:/api/v1/risk_assessments',
  'GET:/api/v1/risk_assessments/export',
  'GET:/api/v1/alerts',
  'GET:/api/v1/alerts/export',
  'GET:/api/v1/risk_types/export?format={format}',
  'GET:/api/v1/controls/export?format={format}',
  'GET:/api/v1/information_systems/export?format={format}',
  'GET:/api/v1/information_assets/export?format={format}',
];

describe('capabilitiesFromOperations', () => {
  it('gives the Requestor birthright exactly the request capabilities and its four exports', () => {
    expect(capabilitiesFromOperations(requestorOperations)).toEqual(new Set(requestorCapabilities));
  });

  it('gives the Security Analyst every capability', () => {
    expect(capabilitiesFromOperations(analystOperations)).toEqual(new Set(capabilities));
  });

  it('withholds a capability unless every one of its anchors is granted', () => {
    const partial = analystOperations.filter((operation) => operation !== 'GET:/api/v1/information_assets');
    expect(capabilitiesFromOperations(partial).has('administration:manage')).toBe(false);
    // My requests and the Requestor Home read GET /v1/my_requests, so reading requests rests on that grant (11-12).
    const withoutMyRequests = requestorOperations.filter((operation) => operation !== 'GET:/api/v1/my_requests');
    expect(capabilitiesFromOperations(withoutMyRequests).has('assessment-request:read')).toBe(false);
    expect(capabilitiesFromOperations([])).toEqual(new Set());
  });

  /* Phase 19 (19-06): Export on the register needs the export and the list read it requires (19-05 underlyingRead). */
  it('grants risk-register:export only with both the register export and the register read', () => {
    const exportUrl = 'GET:/api/v1/risks/export?format={format}';
    expect(capabilityAnchors['risk-register:export']).toEqual(['GET:/api/v1/risks', exportUrl]);
    expect(capabilitiesFromOperations(analystOperations).has('risk-register:export')).toBe(true);
    expect(capabilitiesFromOperations(analystOperations.filter((operation) => operation !== exportUrl)).has('risk-register:export')).toBe(false);
    expect(capabilitiesFromOperations(analystOperations.filter((operation) => operation !== 'GET:/api/v1/risks')).has('risk-register:export')).toBe(false);
    expect(capabilitiesFromOperations(requestorOperations).has('risk-register:export')).toBe(false);
    // The policy literal is exact: the catalogue URL without its query template is not the export's grant.
    expect(capabilitiesFromOperations([...analystOperations.filter((operation) => operation !== exportUrl), 'GET:/api/v1/risks/export']).has('risk-register:export')).toBe(false);
  });

  /* Phase 19 (19-11): Export on a report is its own Function grant, anchored to the report read and the report export. */
  it('grants reports:export only with both the report read and the report export', () => {
    const read = 'GET:/api/v1/reports/{reportKey}';
    const exported = 'POST:/api/v1/reports/{reportKey}/export';
    expect(capabilityAnchors['reports:export']).toEqual([read, exported]);
    expect(capabilitiesFromOperations(analystOperations).has('reports:export')).toBe(true);
    expect(capabilitiesFromOperations(analystOperations.filter((operation) => operation !== exported)).has('reports:export')).toBe(false);
    expect(capabilitiesFromOperations(analystOperations.filter((operation) => operation !== read)).has('reports:export')).toBe(false);
    expect(capabilitiesFromOperations(requestorOperations).has('reports:export')).toBe(false);
  });

  /* Phase 19 (19-11): one capability per export operation, anchored to its list read and its export (19-05 underlyingRead). */
  it.each([
    ['assessment-requests:export', 'GET:/api/v1/assessment_requests', 'GET:/api/v1/assessment_requests/export'],
    ['my-requests:export', 'GET:/api/v1/my_requests', 'GET:/api/v1/my_requests/export'],
    ['questionnaires:export', 'GET:/api/v1/questionnaires', 'GET:/api/v1/questionnaires/export'],
    ['my-questionnaires:export', 'GET:/api/v1/my_questionnaires', 'GET:/api/v1/my_questionnaires/export'],
    ['risk-assessments:export', 'GET:/api/v1/risk_assessments', 'GET:/api/v1/risk_assessments/export'],
    ['my-risk-assessments:export', 'GET:/api/v1/my_risk_assessments', 'GET:/api/v1/my_risk_assessments/export'],
    ['alerts:export', 'GET:/api/v1/alerts', 'GET:/api/v1/alerts/export'],
    // 19-15 (D-33): each reference list's export, anchored to its list read and its export's catalogue URL.
    ['risk-types:export', 'GET:/api/v1/risk_types', 'GET:/api/v1/risk_types/export?format={format}'],
    ['controls:export', 'GET:/api/v1/controls', 'GET:/api/v1/controls/export?format={format}'],
    ['information-systems:export', 'GET:/api/v1/information_systems', 'GET:/api/v1/information_systems/export?format={format}'],
    ['information-assets:export', 'GET:/api/v1/information_assets', 'GET:/api/v1/information_assets/export?format={format}'],
  ] as const)('grants %s only with both its list read and its export', (capability, read, exported) => {
    expect(capabilityAnchors[capability]).toEqual([read, exported]);
    expect(capabilitiesFromOperations(analystOperations).has(capability)).toBe(true);
    // Holding the list read without the export grants no Export, nor does the export without the read.
    expect(capabilitiesFromOperations(analystOperations.filter((operation) => operation !== exported)).has(capability)).toBe(false);
    expect(capabilitiesFromOperations(analystOperations.filter((operation) => operation !== read)).has(capability)).toBe(false);
  });

  /*
   * BE2-01 (3a3606c0): Strapi's released export requires every released read it discloses, the detail, the risks and
   * each Risk's control implementations, so Export shows only where all three are held.
   */
  it('grants released-assessment:export only with the detail, risks and control implementation reads and its export', () => {
    const reads = [
      'GET:/api/v1/risk_assessments/{assessmentId}',
      'GET:/api/v1/risk_assessments/{assessmentId}/risks',
      'GET:/api/v1/risks/{riskId}/control_implementations',
    ];
    const exported = 'GET:/api/v1/risk_assessments/{assessmentId}/export';
    expect(capabilityAnchors['released-assessment:export']).toEqual([...reads, exported]);
    for (const operations of [requestorOperations, analystOperations]) {
      expect(capabilitiesFromOperations(operations).has('released-assessment:export')).toBe(true);
      for (const anchor of [...reads, exported]) {
        expect(capabilitiesFromOperations(operations.filter((operation) => operation !== anchor)).has('released-assessment:export'), anchor).toBe(false);
      }
    }
  });

  it('gives the Requestor birthright none of the analyst exports', () => {
    const granted = capabilitiesFromOperations(requestorOperations);
    for (const capability of ['assessment-requests:export', 'questionnaires:export', 'risk-assessments:export', 'alerts:export', 'reports:export', 'risk-register:export', 'risk-types:export', 'controls:export', 'information-systems:export', 'information-assets:export'] as const) {
      expect(granted.has(capability), capability).toBe(false);
    }
  });

  it('anchors every capability to served operations the web itself calls', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const inventory = JSON.parse(
      readFileSync(resolve(process.cwd(), '../../docs/references/served-operations.json'), 'utf8'),
    ) as { served: Array<{ catalogueUrl: string; webCallers?: string[] }> };
    const calledByWeb = new Set(inventory.served.filter((row) => (row.webCallers ?? []).length > 0).map((row) => row.catalogueUrl));

    // The inventory keys a served operation by its catalogue URL without the query template (19-05), so an anchor
    // such as the register export's GET:/api/v1/risks/export?format={format} is compared the same way.
    for (const capability of capabilities) {
      expect(capabilityAnchors[capability].length).toBeGreaterThan(0);
      for (const operation of capabilityAnchors[capability]) expect(calledByWeb.has(operation.split('?')[0]!), operation).toBe(true);
    }
    expect(calledByWeb.has('GET:/api/v1/risks/export')).toBe(true);
    for (const segment of ['risk_types', 'controls', 'information_systems', 'information_assets']) {
      expect(calledByWeb.has(`GET:/api/v1/${segment}/export`), segment).toBe(true);
    }
  });

  /* 19-15 (D-33): administration:manage (the four list reads) never decides a reference list's Export. */
  it('withholds every reference-list export from the list reads alone', () => {
    const referenceExports = ['risk_types', 'controls', 'information_systems', 'information_assets'].map((segment) => `GET:/api/v1/${segment}/export?format={format}`);
    const readsOnly = analystOperations.filter((operation) => !referenceExports.includes(operation));
    const granted = capabilitiesFromOperations(readsOnly);
    expect(granted.has('administration:manage')).toBe(true);
    for (const capability of ['risk-types:export', 'controls:export', 'information-systems:export', 'information-assets:export'] as const) expect(granted.has(capability), capability).toBe(false);
  });
});

describe('strapiGrantedCapabilities', () => {
  beforeEach(() => {
    getCurrentUserAccessMock.mockReset();
  });

  it("derives capabilities from Strapi's effective operations", async () => {
    getCurrentUserAccessMock.mockResolvedValueOnce({
      data: { displayName: 'Jane Doe', functions: [], operations: requestorOperations },
      error: null,
    });

    await expect(strapiGrantedCapabilities()).resolves.toEqual(new Set(requestorCapabilities));
  });

  it('grants nothing when Strapi refuses or cannot be reached', async () => {
    getCurrentUserAccessMock.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 403 } });

    await expect(strapiGrantedCapabilities()).resolves.toEqual(new Set());
  });
});
