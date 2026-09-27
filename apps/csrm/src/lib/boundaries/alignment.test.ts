import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveSessionRuntimeMode } from '../auth/development-runtime';
import { parseDevelopmentRole, requireDevelopmentRole } from '../auth/session-adapter';
import { validatedReturnTo } from '../auth/return-to';
import { requireCapability } from '../capabilities/server-guard';

describe('web server trust boundaries', () => {
  it('limits fixture sessions to an explicit development build or the attested E2E runtime', () => {
    const environment = (variables: Record<string, string | undefined>) => variables as NodeJS.ProcessEnv;

    // The second argument is the compilation: 'development' for next dev, 'production' for next build.
    expect(resolveSessionRuntimeMode(environment({ NODE_ENV: 'development' }), 'development')).toBe('development');
    expect(resolveSessionRuntimeMode(environment({ NODE_ENV: 'production' }), 'production')).toBe('unavailable');
    expect(resolveSessionRuntimeMode(environment({ NODE_ENV: 'test' }), 'production')).toBe('unavailable');
    expect(resolveSessionRuntimeMode(environment({}), 'production')).toBe('unavailable');
    // SR-01: a production build started with NODE_ENV=development is still a production build.
    expect(resolveSessionRuntimeMode(environment({ NODE_ENV: 'development' }), 'production')).toBe('unavailable');
  });

  it('validates development role values from cookies and FormData', () => {
    expect(parseDevelopmentRole('Requestor')).toBe('Requestor');
    expect(parseDevelopmentRole('Security Analyst')).toBe('Security Analyst');
    expect(parseDevelopmentRole('Administrator')).toBeNull();
    expect(requireDevelopmentRole('Requestor')).toBe('Requestor');
    expect(() => requireDevelopmentRole('Administrator')).toThrow('Invalid development role.');
  });

  it('only preserves safe internal return paths', () => {
    expect(validatedReturnTo('/app/requests/new')).toBe('/app/requests/new');
    expect(validatedReturnTo('https://example.test')).toBe('/app');
    expect(validatedReturnTo('//example.test')).toBe('/app');
    expect(validatedReturnTo('/app\\review')).toBe('/app');
  });

  it('denies missing presentation capabilities without exposing records', () => {
    expect(() => requireCapability('assessment-request:read', new Set(['assessment-request:read']))).not.toThrow();
    expect(() => requireCapability('risk:manage', new Set())).toThrow('Capability access is not available.');
  });
});
