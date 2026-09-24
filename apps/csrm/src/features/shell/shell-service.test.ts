import { describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const normalizeTransportError = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: () => ({ GET: get }),
  normalizeTransportError,
}));

import { listShellApplications } from './shell-service';

describe('listShellApplications', () => {
  it('maps validated transport data to shell applications', async () => {
    get.mockResolvedValue({
      data: { data: [{ id: 7, name: 'Identity platform' }] },
      error: undefined,
      response: { status: 200 },
    });

    await expect(listShellApplications()).resolves.toEqual({
      data: [{ id: '7', name: 'Identity platform' }],
      error: null,
    });
  });

  it('normalizes a failed transport response without exposing raw error details', async () => {
    const safeResult = {
      data: null,
      error: { message: 'The CSRM service is unavailable. Please try again later.', status: 503 },
    };
    const rawError = { error: { message: 'internal Strapi detail' } };

    get.mockResolvedValue({ data: undefined, error: rawError, response: { status: 503 } });
    normalizeTransportError.mockReturnValue(safeResult);

    await expect(listShellApplications()).resolves.toEqual(safeResult);
    expect(normalizeTransportError).toHaveBeenCalledWith(rawError, 503);
  });
});
