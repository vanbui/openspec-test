import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes, ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/*
 * next/font/local is compiled away by Next, and outside it the loader throws. The stub returns the
 * shape the fonts module reads, named after each call's CSS variable, so the test can see which font
 * variables reach the document.
 */
vi.mock('next/font/local', () => ({
  default: (options: { variable: string }) => {
    const name = options.variable.replace(/^--font-/, '');
    return { className: `${name}-font`, style: { fontFamily: name }, variable: `${name}-variable` };
  },
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

import ShellNotFound, { metadata as shellNotFoundMetadata } from '../../../app/(app)/not-found';
import GlobalError, { GlobalErrorCard } from '../../../app/global-error';
import RootNotFound, { metadata as rootNotFoundMetadata } from '../../../app/not-found';

/* The locked copy (UI-SPEC section 9.3). */
const notFoundCopy = {
  action: 'Return to workspace',
  heading: 'Page not found',
  lead: 'The page you asked for doesn’t exist or has moved.',
  title: 'Page not found | IdamBox CSRM',
};
const globalErrorCopy = {
  action: 'Try again',
  heading: 'Something went wrong',
  lead: 'The application hit an unexpected error. Please try again. If the problem continues, contact your administrator.',
  title: 'Something went wrong | IdamBox CSRM',
};

describe.each([
  ['root', RootNotFound as ComponentType, rootNotFoundMetadata],
  ['in-shell', ShellNotFound as ComponentType, shellNotFoundMetadata],
])('the %s not-found', (_name, NotFound, metadata) => {
  it('states the locked copy under one level-one heading, with one way back to the workspace', () => {
    render(<NotFound />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: notFoundCopy.heading })).toBeInTheDocument();
    expect(screen.getByText(notFoundCopy.lead)).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    const action = screen.getByRole('link', { name: notFoundCopy.action });
    expect(action).toHaveAttribute('href', '/app');
    // The primary pill (direction section 4 Buttons).
    expect(action).toHaveClass('rounded-full', 'bg-primary');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('titles the document', () => {
    expect(metadata).toEqual({ title: notFoundCopy.title });
  });
});

describe('the root not-found', () => {
  it('renders in the sign-in card frame, without the shell', () => {
    const { container } = render(<RootNotFound />);

    const card = container.querySelector('main.sign-in > section.sign-in-card');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByRole('heading', { level: 1, name: notFoundCopy.heading })).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText('IdamBox CSRM')).toBeInTheDocument();
    expect(within(card as HTMLElement).getByRole('link', { name: notFoundCopy.action })).toHaveClass('h-control-h');
    expect(container.querySelector('nav, .sidebar, .header, header')).toBeNull();
  });
});

describe('the in-shell not-found', () => {
  it('is page content for the shell’s main landmark and shows nothing but the locked copy', () => {
    const { container } = render(<ShellNotFound />);

    // The shell supplies main, the banner and the navigation; the fallback adds none of them.
    expect(container.querySelector('main, nav, header, .sign-in, .sign-in-card')).toBeNull();
    expect(container.querySelector('.page-header h1')).toHaveTextContent(notFoundCopy.heading);
    expect(container.textContent).toBe(`${notFoundCopy.heading}${notFoundCopy.lead}${notFoundCopy.action}`);
  });
});

describe('the global error', () => {
  const error = Object.assign(new Error('internal secret detail'), { digest: 'digest-7f3a9c' });

  it('renders its own document with the stylesheet fonts, the title and the locked copy', () => {
    const markup = renderToStaticMarkup(<GlobalError error={error} retry={() => undefined} />);

    expect(markup).toContain('<html lang="en" class="jakarta-variable jakarta-latin-ext-variable instrument-variable instrument-latin-ext-variable plex-mono-variable plex-mono-latin-ext-variable"');
    expect(markup).toContain('<body');
    expect(markup).toContain(`<title>${globalErrorCopy.title}</title>`);
    expect(markup).toContain(`<h1>${globalErrorCopy.heading}</h1>`);
    expect(markup).toContain(globalErrorCopy.lead);
    expect(markup).toMatch(/<button[^>]*type="button"[^>]*>Try again<\/button>/);
  });

  it('never shows the error it receives: no message, digest or stack', () => {
    const markup = renderToStaticMarkup(<GlobalError error={error} retry={() => undefined} />);
    const firstFrame = error.stack?.split('\n')[1]?.trim();

    expect(markup).not.toContain('internal secret detail');
    expect(markup).not.toContain('digest-7f3a9c');
    expect(markup.toLowerCase()).not.toContain('digest');
    expect(firstFrame).toBeTruthy();
    expect(markup).not.toContain(firstFrame!);
  });

  it('retries once when Try again is chosen', async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<GlobalErrorCard retry={retry} />);

    expect(container.querySelector('main.sign-in > section.sign-in-card')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: globalErrorCopy.heading })).toBeInTheDocument();
    expect(screen.getByText(globalErrorCopy.lead)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: globalErrorCopy.action }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
