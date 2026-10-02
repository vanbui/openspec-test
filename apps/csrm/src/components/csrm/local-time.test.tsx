/** @vitest-environment jsdom */

import { act, render, waitFor } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  syncViewerTimeZoneAction: vi.fn(),
}));

vi.mock('@/lib/time/time-zone-actions', () => ({ syncViewerTimeZoneAction: mocks.syncViewerTimeZoneAction }));

import { LocalInstant, TimeZoneProvider, useViewerTimeZone, ViewerTimeZoneSync } from './local-time';

const instant = '2026-09-27T05:47:00.000Z';
const normalised = (value: string | null | undefined) => value?.replace(/\s/g, ' ');

function stubBrowserZone(timeZone: string) {
  const original = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...original.call(this), timeZone };
  });
}

beforeEach(() => {
  mocks.syncViewerTimeZoneAction.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.syncViewerTimeZoneAction.mockReset();
});

describe('LocalInstant', () => {
  it('renders the instant in the provided zone inside a time element', () => {
    const { container } = render(
      <TimeZoneProvider zone="Australia/Brisbane"><LocalInstant style="date-time" value={instant} /></TimeZoneProvider>,
    );
    const time = container.querySelector('time');
    expect(time).toHaveAttribute('dateTime', instant);
    expect(normalised(time?.textContent)).toBe('27 Sept 2026, 3:47 pm');
  });

  it('renders UTC with the label outside any provider', () => {
    const { container } = render(<LocalInstant style="date-time" value={instant} />);
    expect(normalised(container.querySelector('time')?.textContent)).toBe('27 Sept 2026, 5:47 am UTC');
  });

  it('renders the fallback, and no time element, for a missing or invalid value', () => {
    const missing = render(<LocalInstant fallback="Not recorded" style="date-time" value={null} />);
    expect(missing.container.querySelector('time')).toBeNull();
    expect(missing.container).toHaveTextContent('Not recorded');
    missing.unmount();

    const invalid = render(<LocalInstant style="date" value="not a date" />);
    expect(invalid.container.querySelector('time')).toBeNull();
    expect(invalid.container).toBeEmptyDOMElement();
  });
});

/*
 * WR-304: the server (Node's ICU) and the browser (its own ICU and CLDR) can word the same instant differently,
 * for example Sep or Sept, or a narrow no-break space before pm. The text is the same instant in the same zone, so
 * a difference must not raise a hydration error and client-render the page; the server's wording stays.
 */
describe('LocalInstant hydration (WR-304)', () => {
  it('hydrates without a recoverable error when the browser words the instant differently from the server', async () => {
    const tree = <TimeZoneProvider zone="Australia/Brisbane"><p>Saved <LocalInstant style="date-time" value={instant} /></p></TimeZoneProvider>;
    const host = document.createElement('div');
    document.body.append(host);
    // The server's ICU wrote another CLDR wording of the same instant.
    host.innerHTML = renderToString(tree).replace('Sept', 'Sep');
    expect(host.querySelector('time')?.textContent).toContain('Sep ');
    const recoverable = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const root = await act(async () => hydrateRoot(host, tree, { onRecoverableError: recoverable }));

    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(host.querySelector('time')).toHaveAttribute('dateTime', instant);
    expect(normalised(host.querySelector('time')?.textContent)).toBe('27 Sep 2026, 3:47 pm');
    act(() => root.unmount());
    host.remove();
  });
});

describe('useViewerTimeZone', () => {
  function Probe() {
    return <span>{useViewerTimeZone() ?? 'unknown'}</span>;
  }

  it('reads the provided zone, or null outside a provider', () => {
    const inside = render(<TimeZoneProvider zone="Australia/Brisbane"><Probe /></TimeZoneProvider>);
    expect(inside.container).toHaveTextContent('Australia/Brisbane');
    inside.unmount();
    expect(render(<Probe />).container).toHaveTextContent('unknown');
  });
});

/*
 * The action sets the cookie, and Next re-renders the route in the same round trip, so the sync's
 * observable contract here is one call with the browser's zone. The in-place re-render is proved in
 * the browser (questionnaire-governance-workflow.spec.ts, UX06_TIMELINE_SHOWS_LOCAL_TIME).
 */
describe('ViewerTimeZoneSync', () => {
  it('sends the browser’s zone once when it differs from the cookie, rendering nothing', async () => {
    stubBrowserZone('Australia/Brisbane');
    const { container, rerender } = render(<TimeZoneProvider zone={null}><ViewerTimeZoneSync /></TimeZoneProvider>);

    await waitFor(() => expect(mocks.syncViewerTimeZoneAction).toHaveBeenCalledExactlyOnceWith('Australia/Brisbane'));
    expect(container).toBeEmptyDOMElement();

    // The route re-renders with the stored zone; the mounted sync does not send it again.
    rerender(<TimeZoneProvider zone="Australia/Brisbane"><ViewerTimeZoneSync /></TimeZoneProvider>);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.syncViewerTimeZoneAction).toHaveBeenCalledOnce();
  });

  it('does nothing when the cookie already holds the browser’s zone', async () => {
    stubBrowserZone('Australia/Brisbane');
    render(<TimeZoneProvider zone="Australia/Brisbane"><ViewerTimeZoneSync /></TimeZoneProvider>);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.syncViewerTimeZoneAction).not.toHaveBeenCalled();
  });

  it('does nothing when the browser reports no valid zone', async () => {
    stubBrowserZone('Mars/Olympus');
    render(<TimeZoneProvider zone={null}><ViewerTimeZoneSync /></TimeZoneProvider>);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.syncViewerTimeZoneAction).not.toHaveBeenCalled();
  });

  it('swallows a failed sync, leaving times labelled UTC', async () => {
    stubBrowserZone('Australia/Brisbane');
    mocks.syncViewerTimeZoneAction.mockRejectedValue(new Error('offline'));
    const { container } = render(
      <TimeZoneProvider zone={null}><ViewerTimeZoneSync /><LocalInstant style="time" value={instant} /></TimeZoneProvider>,
    );

    await waitFor(() => expect(mocks.syncViewerTimeZoneAction).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(normalised(container.querySelector('time')?.textContent)).toBe('5:47 am UTC');
  });
});
