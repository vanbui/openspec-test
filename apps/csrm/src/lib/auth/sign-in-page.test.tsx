import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import SignIn, { generateMetadata } from '../../../app/sign-in/page';

const unavailableCopy = {
  heading: 'Sign-in unavailable',
  lead: 'Session authentication is not configured. Contact your administrator.',
  note: 'Access is granted by your organisation’s authorization service, never by navigation alone.',
  title: 'Sign-in unavailable | IdamBox CSRM',
};

async function renderSignIn(searchParams: { returnTo?: string } = {}): Promise<void> {
  render(await SignIn({ searchParams: Promise.resolve(searchParams) }));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the sign-in page when the development session is unavailable', () => {
  beforeEach(() => {
    // A production build without the attested runtime: the two variables alone open nothing.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CSRM_ENVIRONMENT', 'development');
    vi.stubEnv('CSRM_DEV_IDENTITY', 'true');
    for (const variable of ['CSRM_E2E_RUNTIME_ROOT', 'CSRM_E2E_RUNTIME_ATTESTATION_PATH', 'CSRM_E2E_RUNTIME_NONCE']) {
      vi.stubEnv(variable, undefined);
    }
  });

  it('renders the unavailable card with the locked copy', async () => {
    await renderSignIn();

    expect(screen.getByRole('heading', { level: 1, name: unavailableCopy.heading })).toBeInTheDocument();
    expect(screen.getByText('IdamBox CSRM')).toBeInTheDocument();
    expect(screen.getByText(unavailableCopy.lead)).toBeInTheDocument();
    expect(screen.getByText(unavailableCopy.note)).toBeInTheDocument();
    expect(document.querySelector('main.sign-in > section.sign-in-card')).not.toBeNull();
  });

  it('offers no way to sign in and names no development feature', async () => {
    await renderSignIn({ returnTo: '/app' });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(document.querySelector('form')).toBeNull();
    expect(screen.queryByText(/Continue as/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Strapi/)).not.toBeInTheDocument();
    expect(screen.queryByText(/development/i)).not.toBeInTheDocument();
  });

  it('titles the document as unavailable', async () => {
    await expect(generateMetadata()).resolves.toEqual({ title: unavailableCopy.title });
  });
});

describe('the sign-in page when the development session is available', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  it('offers the four fixture identities, Second Security Analyst after Security Analyst (D-31, UI-D26)', async () => {
    await renderSignIn({ returnTo: '/app/requests' });

    expect(screen.getByRole('heading', { level: 1, name: 'Development sign-in' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Continue as Requestor',
      'Continue as Secondary Requestor',
      'Continue as Security Analyst',
      'Continue as Second Security Analyst',
    ]);
    const second = screen.getByRole('button', { name: 'Continue as Second Security Analyst' });
    expect(second).toHaveAttribute('name', 'role');
    expect(second).toHaveAttribute('value', 'Second Security Analyst');
    expect(second.className).toBe(screen.getByRole('button', { name: 'Continue as Security Analyst' }).className);
    expect(document.querySelector('form.sign-in-actions input[name="returnTo"]')).toHaveValue('/app/requests');
    expect(screen.queryByText(unavailableCopy.heading)).not.toBeInTheDocument();
  });

  it('names the page in its document title, as every other page does', async () => {
    // The phase UI review, verdict 1: the title was the site name alone, the only one that did not name its page.
    await expect(generateMetadata()).resolves.toEqual({ title: 'Development sign-in | IdamBox CSRM' });
  });
});
