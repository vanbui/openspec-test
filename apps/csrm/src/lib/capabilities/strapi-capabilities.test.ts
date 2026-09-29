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
  'GET:/api/v1/assessment_requests/{requestId}',
];
const analystOperations = [
  ...requestorOperations,
  'GET:/api/v1/assessment_requests',
  'GET:/api/v1/risks',
  'GET:/api/v1/risk_types',
  'GET:/api/v1/controls',
  'GET:/api/v1/information_systems',
  'GET:/api/v1/information_assets',
];

describe('capabilitiesFromOperations', () => {
  it('gives the Requestor birthright exactly the request capabilities', () => {
    expect(capabilitiesFromOperations(requestorOperations)).toEqual(new Set(['assessment-request:create', 'assessment-request:read']));
  });

  it('gives the Security Analyst every capability', () => {
    expect(capabilitiesFromOperations(analystOperations)).toEqual(new Set(capabilities));
  });

  it('withholds a capability unless every one of its anchors is granted', () => {
    const partial = analystOperations.filter((operation) => operation !== 'GET:/api/v1/information_assets');
    expect(capabilitiesFromOperations(partial).has('administration:manage')).toBe(false);
    expect(capabilitiesFromOperations([])).toEqual(new Set());
  });

  it('anchors every capability to served operations the web itself calls', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const inventory = JSON.parse(
      readFileSync(resolve(process.cwd(), '../../docs/references/served-operations.json'), 'utf8'),
    ) as { served: Array<{ catalogueUrl: string; webCallers?: string[] }> };
    const calledByWeb = new Set(inventory.served.filter((row) => (row.webCallers ?? []).length > 0).map((row) => row.catalogueUrl));

    for (const capability of capabilities) {
      expect(capabilityAnchors[capability].length).toBeGreaterThan(0);
      for (const operation of capabilityAnchors[capability]) expect(calledByWeb.has(operation), operation).toBe(true);
    }
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

    await expect(strapiGrantedCapabilities()).resolves.toEqual(new Set(['assessment-request:create', 'assessment-request:read']));
  });

  it('grants nothing when Strapi refuses or cannot be reached', async () => {
    getCurrentUserAccessMock.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 403 } });

    await expect(strapiGrantedCapabilities()).resolves.toEqual(new Set());
  });
});
