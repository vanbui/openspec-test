import { describe, expect, it } from 'vitest';

import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { DevelopmentCapabilityAdapter } from './development-capabilities';

describe('development capability projection', () => {
  it('keeps Requestor navigation limited to request capabilities', async () => {
    const granted = await new DevelopmentCapabilityAdapter('Requestor').granted();

    expect(granted).toEqual(new Set(['assessment-request:create', 'assessment-request:read']));
    expect(granted.has('assessment:review')).toBe(false);
    expect(granted.has('risk:manage')).toBe(false);
  });

  it('projects all shell capabilities for a Security Analyst fixture', async () => {
    const granted = await new DevelopmentCapabilityAdapter('Security Analyst').granted();

    expect(granted).toEqual(new Set([
      'assessment-request:create',
      'assessment-request:read',
      'assessment:review',
      'risk:manage',
      'administration:manage',
    ]));
  });
});
