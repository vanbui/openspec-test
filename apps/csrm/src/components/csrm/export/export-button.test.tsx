import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Component, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ toastError: vi.fn() }));

/*
 * The app bundles the App Router's next/dynamic (React.lazy in a Suspense boundary, with no error handling); vitest
 * otherwise resolves the Pages Router's, which swallows a failed load. The export button is pinned against the former.
 */
vi.mock('next/dynamic', async () => {
  const appDynamic = await import('next/dist/shared/lib/app-dynamic') as unknown as { default: { default?: unknown } | unknown };
  const loadable = appDynamic.default as { default?: unknown };
  return { default: loadable.default ?? loadable };
});
/* A failed load of the dialog's code: a flaky network, or a deploy that replaced the chunks the page knew. */
vi.mock('./export-dialog', () => {
  throw new Error('ChunkLoadError: Loading chunk export-dialog failed.');
});
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));

/** The route's error boundary, which would replace the whole page. */
class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? <p>The route error boundary</p> : this.props.children;
  }
}

afterEach(() => {
  mocks.toastError.mockReset();
  vi.restoreAllMocks();
});

/*
 * FE4-12 (19-UI-SPEC §2.1, §6 S1): a failed load of the dialog's code stays with the button. The page keeps its list and
 * its Export, and S1's failed-file copy offers Try again, which loads the code again.
 */
describe('the export button when the dialog’s code fails to load', () => {
  it('keeps the page and its Export, and says so with S1’s copy and Try again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ExportButton } = await import('./export-button');
    const user = userEvent.setup();
    render(
      <RouteErrorBoundary>
        <main>
          <h1>Risk register</h1>
          <ExportButton action={vi.fn()} chips={[]} heading="Risk register" multiplePages={false} query={{}} searchActive={false} total={1} view="risk-register" />
        </main>
      </RouteErrorBoundary>,
    );

    const exportButton = screen.getByRole('button', { name: 'Export Risk register' });
    await user.click(exportButton);

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('The route error boundary')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Risk register' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(exportButton).toBeInTheDocument();
    expect(exportButton).toHaveFocus();
    expect(exportButton.querySelector('.animate-spin')).toBeNull();

    const [message, options] = mocks.toastError.mock.calls[0] as [string, { action?: { label: string; onClick: (event: unknown) => void } }];
    expect(message).toBe('We couldn’t create the file.');
    expect(options.action?.label).toBe('Try again');
    options.action!.onClick({});
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('The route error boundary')).not.toBeInTheDocument();
  });
});
