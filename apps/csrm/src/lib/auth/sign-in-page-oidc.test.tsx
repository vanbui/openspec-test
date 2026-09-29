import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import SignIn, { generateMetadata } from '../../../app/sign-in/page';

async function renderSignIn(searchParams: { returnTo?: string; error?: string } = {}): Promise<void> {
  render(await SignIn({ searchParams: Promise.resolve(searchParams) }));
}

beforeEach(() => {
  vi.stubEnv('CSRM_AUTH_OIDC_ENABLED', 'true');
  vi.stubEnv('NODE_ENV', 'development');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the sign-in page in OIDC mode', () => {
  it('renders exactly one button inside a form with a hidden validated returnTo', async () => {
    await renderSignIn({ returnTo: '/app/risks' });

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Continue with your organisation’s IdamBox account.')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Continue to IdamBox sign-in');

    const form = document.querySelector('form.sign-in-actions');
    expect(form).not.toBeNull();
    expect(form?.querySelector('input[name="returnTo"]')).toHaveValue('/app/risks');
  });

  it('names no development feature and no Strapi text', async () => {
    await renderSignIn();

    expect(screen.queryByText(/Continue as/)).not.toBeInTheDocument();
    expect(screen.queryByText(/development/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Strapi/)).not.toBeInTheDocument();
  });

  it('shows the fixed alert text on an error, never the parameter value', async () => {
    await renderSignIn({ error: 'Configuration' });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Sign-in did not complete. Try again or contact your administrator.');
    expect(alert).not.toHaveTextContent('Configuration');
  });

  it('shows no alert when there is no error', async () => {
    await renderSignIn();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('titles the document for OIDC sign-in', async () => {
    await expect(generateMetadata()).resolves.toEqual({ title: 'Sign in | IdamBox CSRM' });
  });
});

describe('the sign-in page falls back to the unavailable card in a production build with the flag true', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  it('renders the unavailable card', async () => {
    await renderSignIn();

    expect(screen.getByRole('heading', { level: 1, name: 'Sign-in unavailable' })).toBeInTheDocument();
  });
});
