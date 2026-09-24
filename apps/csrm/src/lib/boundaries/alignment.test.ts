import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  parseDevelopmentRole,
  parseSessionRuntimeMode,
  requireDevelopmentRole,
} from '../auth/session-adapter';
import { validatedReturnTo } from '../auth/return-to';
import { requireCapability } from '../capabilities/server-guard';
import { parseShellApplications } from '../../features/shell/shell-service';

describe('web server trust boundaries', () => {
  it('limits fixture sessions to an explicit development build', () => {
    expect(parseSessionRuntimeMode('development')).toBe('development');
    expect(parseSessionRuntimeMode('production')).toBe('unavailable');
    expect(parseSessionRuntimeMode('test')).toBe('unavailable');
    expect(parseSessionRuntimeMode(undefined)).toBe('unavailable');
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

  it('parses application transport data before constructing UI models', () => {
    expect(parseShellApplications({ data: [{ id: 42, name: 'Identity platform' }] })).toEqual([
      { id: '42', name: 'Identity platform' },
    ]);
    expect(() => parseShellApplications({})).toThrow();
    expect(() => parseShellApplications({ data: {} })).toThrow();
    expect(() => parseShellApplications({ data: [{ id: null, name: 'Identity platform' }] })).toThrow();
    expect(() => parseShellApplications({ data: [{ id: 42, name: '' }] })).toThrow();
  });
});
