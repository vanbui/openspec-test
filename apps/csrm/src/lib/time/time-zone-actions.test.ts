import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn() },
  requestHeaders: new Map<string, string>(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => mocks.cookieStore,
  headers: async () => ({ get: (name: string) => mocks.requestHeaders.get(name.toLowerCase()) ?? null }),
}));

import { syncViewerTimeZoneAction } from './time-zone-actions';

const oneYear = 60 * 60 * 24 * 365;

beforeEach(() => {
  mocks.cookieStore.set.mockReset();
  mocks.requestHeaders.clear();
});

describe('syncViewerTimeZoneAction', () => {
  it('stores a valid zone in an httpOnly, lax, site-wide cookie for a year', async () => {
    await expect(syncViewerTimeZoneAction('Australia/Brisbane')).resolves.toEqual({ ok: true });

    expect(mocks.cookieStore.set).toHaveBeenCalledOnce();
    expect(mocks.cookieStore.set).toHaveBeenCalledWith('csrm-time-zone', 'Australia/Brisbane', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: oneYear,
    });
  });

  it('marks the cookie Secure only when the request arrived over https', async () => {
    mocks.requestHeaders.set('x-forwarded-proto', 'https, http');
    await syncViewerTimeZoneAction('Australia/Brisbane');
    expect(mocks.cookieStore.set.mock.calls[0]?.[2]).toMatchObject({ secure: true });

    mocks.cookieStore.set.mockReset();
    mocks.requestHeaders.set('x-forwarded-proto', 'http');
    await syncViewerTimeZoneAction('Australia/Brisbane');
    expect(mocks.cookieStore.set.mock.calls[0]?.[2]).toMatchObject({ secure: false });
  });

  it.each([
    ['an unknown zone', 'Mars/Olympus'],
    ['an empty string', ''],
    ['a 65-character string', 'A'.repeat(65)],
    ['a number', 10],
    ['an object', { zone: 'Australia/Brisbane' }],
  ])('refuses %s and sets nothing', async (_name, zone) => {
    await expect(syncViewerTimeZoneAction(zone)).resolves.toEqual({ ok: false });
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
  });
});
