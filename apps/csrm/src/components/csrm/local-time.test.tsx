/** @vitest-environment jsdom */

import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  syncViewerTimeZoneAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
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
  mocks.refresh.mockReset();
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

describe('ViewerTimeZoneSync', () => {
  it('sends the browser’s zone when it differs from the cookie, then refreshes the route, rendering nothing', async () => {
    stubBrowserZone('Australia/Brisbane');
    const { container } = render(<TimeZoneProvider zone={null}><ViewerTimeZoneSync /></TimeZoneProvider>);

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.syncViewerTimeZoneAction).toHaveBeenCalledExactlyOnceWith('Australia/Brisbane');
    expect(container).toBeEmptyDOMElement();
  });

  it('does nothing when the cookie already holds the browser’s zone', async () => {
    stubBrowserZone('Australia/Brisbane');
    render(<TimeZoneProvider zone="Australia/Brisbane"><ViewerTimeZoneSync /></TimeZoneProvider>);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.syncViewerTimeZoneAction).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('does not refresh when the server refuses the zone', async () => {
    stubBrowserZone('Australia/Brisbane');
    mocks.syncViewerTimeZoneAction.mockResolvedValue({ ok: false });
    render(<TimeZoneProvider zone="Europe/London"><ViewerTimeZoneSync /></TimeZoneProvider>);

    await waitFor(() => expect(mocks.syncViewerTimeZoneAction).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
