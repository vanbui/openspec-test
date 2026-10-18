import { describe, expect, it } from 'vitest';

import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { DevelopmentCapabilityAdapter } from './development-capabilities';

/*
 * Phase 19 (19-11): the Requestor birthright's exports (My requests, My questionnaires, My risk assessments and the
 * released assessment) are every person's, as Strapi grants them to role.requestor; the analyst exports are the two
 * Security Analyst fixtures' only.
 */
const requestorCapabilities = [
  'assessment-request:create',
  'assessment-request:read',
  'my-requests:export',
  'my-questionnaires:export',
  'my-risk-assessments:export',
  'released-assessment:export',
];

describe('development capability projection', () => {
  it('keeps Requestor navigation limited to request capabilities and the birthright exports', async () => {
    const granted = await new DevelopmentCapabilityAdapter('Requestor').granted();

    expect(granted).toEqual(new Set(requestorCapabilities));
    for (const analystExport of ['assessment-requests:export', 'questionnaires:export', 'risk-assessments:export', 'alerts:export', 'risk-types:export', 'controls:export', 'information-systems:export', 'information-assets:export']) {
      expect(granted.has(analystExport as never), analystExport).toBe(false);
    }
    expect(granted.has('assessment:review')).toBe(false);
    expect(granted.has('risk:manage')).toBe(false);
    expect(granted.has('risk-register:export')).toBe(false);
    expect(granted.has('reports:export')).toBe(false);
  });

  it('withholds the register export from the Secondary Requestor (19-06), who holds the Requestor birthright exports (19-11)', async () => {
    const granted = await new DevelopmentCapabilityAdapter('Secondary Requestor').granted();

    expect(granted.has('risk-register:export')).toBe(false);
    expect(granted).toEqual(new Set(requestorCapabilities));
  });

  it('projects all shell capabilities for a Security Analyst fixture', async () => {
    const granted = await new DevelopmentCapabilityAdapter('Security Analyst').granted();

    expect(granted).toEqual(new Set([
      'assessment-request:create',
      'assessment-request:read',
      'assessment:review',
      'risk:manage',
      'administration:manage',
      'risk-register:export',
      'reports:export',
      'assessment-requests:export',
      'my-requests:export',
      'questionnaires:export',
      'my-questionnaires:export',
      'risk-assessments:export',
      'my-risk-assessments:export',
      'alerts:export',
      'released-assessment:export',
      // 19-15 (D-33): the reference-list exports, as Strapi grants the Administration Functions.
      'risk-types:export',
      'controls:export',
      'information-systems:export',
      'information-assets:export',
    ]));
  });

  it('projects the same shell capabilities for the Second Security Analyst fixture (D-31)', async () => {
    const granted = await new DevelopmentCapabilityAdapter('Second Security Analyst').granted();

    expect(granted).toEqual(await new DevelopmentCapabilityAdapter('Security Analyst').granted());
  });
});
