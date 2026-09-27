import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { installTestResizeObserver, stubHorizontalGeometry, stubRenderedWidth, TestResizeObserver } from '@/test/layout-stubs';

import { HorizontalScrollRegion, horizontalScrollRegionProps, useHorizontalOverflow } from './horizontal-scroll-region';

beforeEach(() => {
  installTestResizeObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function OverflowProbe({ stickyFirstCell = false }: { stickyFirstCell?: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { atEnd, overflowing } = useHorizontalOverflow(scrollerRef, []);

  return (
    <>
      <output data-testid="overflow">{`${overflowing ? 'overflowing' : 'fits'}, ${atEnd ? 'at end' : 'before end'}`}</output>
      <div data-testid="scroller" ref={scrollerRef}>
        <Table aria-label="Probe">
          <TableHeader>
            <TableRow>
              <TableHead style={stickyFirstCell ? { position: 'sticky' } : undefined}>Risk number</TableHead>
              <TableHead>Statement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>RSK-1</TableCell>
              <TableCell>A statement</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function overflowOf() {
  return screen.getByTestId('overflow').textContent;
}

function resize() {
  act(() => TestResizeObserver.notifyAll());
}

describe('useHorizontalOverflow', () => {
  it('reports whether the scroller is wider than its container and whether it has reached the end', () => {
    const view = render(<OverflowProbe />);
    const scroller = screen.getByTestId('scroller');
    expect(overflowOf()).toBe('fits, at end');

    stubHorizontalGeometry(scroller, { scrollWidth: 900, clientWidth: 600 });
    resize();
    expect(overflowOf()).toBe('overflowing, before end');

    scroller.scrollLeft = 300;
    fireEvent.scroll(scroller);
    expect(overflowOf()).toBe('overflowing, at end');

    scroller.scrollLeft = 120;
    fireEvent.scroll(scroller);
    expect(overflowOf()).toBe('overflowing, before end');

    stubHorizontalGeometry(scroller, { scrollWidth: 600, clientWidth: 600 });
    resize();
    expect(overflowOf()).toBe('fits, at end');

    expect(TestResizeObserver.connected.size).toBe(1);
    view.unmount();
    expect(TestResizeObserver.connected.size).toBe(0);
  });

  it('observes the scroller, its first child and its table, so a wider table re-evaluates it', () => {
    render(<OverflowProbe />);
    const scroller = screen.getByTestId('scroller');
    const [observer] = Array.from(TestResizeObserver.connected);

    expect(Array.from(observer.targets)).toEqual([
      scroller,
      scroller.querySelector('[data-slot="table-container"]'),
      scroller.querySelector('table'),
    ]);
  });

  it('measures without a ResizeObserver, as jsdom and older engines run it', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('ResizeObserver', undefined);
    render(<OverflowProbe />);
    const scroller = screen.getByTestId('scroller');
    expect(overflowOf()).toBe('fits, at end');

    stubHorizontalGeometry(scroller, { scrollWidth: 900, clientWidth: 600 });
    fireEvent.scroll(scroller);
    expect(overflowOf()).toBe('overflowing, before end');
  });

  it('pads the scroll start by the sticky first column, so a focused cell is never hidden under it', () => {
    render(<OverflowProbe stickyFirstCell />);
    const scroller = screen.getByTestId('scroller');
    stubRenderedWidth(screen.getByRole('columnheader', { name: 'Risk number' }), 120);

    stubHorizontalGeometry(scroller, { scrollWidth: 900, clientWidth: 600 });
    resize();
    expect(scroller.style.getPropertyValue('--table-sticky-inline-start')).toBe('120px');
  });

  it('adds no scroll padding when the first column is not sticky', () => {
    render(<OverflowProbe />);
    const scroller = screen.getByTestId('scroller');
    stubRenderedWidth(screen.getByRole('columnheader', { name: 'Risk number' }), 120);

    stubHorizontalGeometry(scroller, { scrollWidth: 900, clientWidth: 600 });
    resize();
    expect(scroller.style.getPropertyValue('--table-sticky-inline-start')).toBe('0px');
  });
});

describe('horizontalScrollRegionProps', () => {
  it('names a focusable region after the table only while it overflows', () => {
    expect(horizontalScrollRegionProps('Risk Register results', true)).toEqual({
      role: 'region',
      'aria-label': 'Risk Register results, scrolls horizontally',
      tabIndex: 0,
    });
    expect(horizontalScrollRegionProps('Risk Register results', false)).toEqual({});
  });
});

describe('HorizontalScrollRegion', () => {
  function GuidanceTable() {
    return (
      <HorizontalScrollRegion className="overflow-x-auto rounded-lg border" label="Risk Type CSV columns">
        <Table aria-label="Risk Type CSV columns">
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead>Required</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>name</TableCell>
              <TableCell>Required</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </HorizontalScrollRegion>
    );
  }

  it('is the single scroller, and becomes a labelled, focusable region only while its table overflows', () => {
    render(<GuidanceTable />);
    const wrapper = screen.getByRole('table', { name: 'Risk Type CSV columns' }).closest('[data-overflow]') as HTMLElement;
    const container = wrapper.querySelector('[data-slot="table-container"]');

    expect(wrapper).toHaveClass('overflow-x-auto', 'rounded-lg', 'border', '[&>[data-slot=table-container]]:overflow-visible');
    expect(wrapper).toHaveAttribute('data-overflow', 'false');
    for (const attribute of ['role', 'aria-label', 'tabindex']) expect(wrapper).not.toHaveAttribute(attribute);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    stubHorizontalGeometry(wrapper, { scrollWidth: 520, clientWidth: 311 });
    resize();

    expect(screen.getByRole('region', { name: 'Risk Type CSV columns, scrolls horizontally' })).toBe(wrapper);
    expect(wrapper).toHaveAttribute('tabindex', '0');
    expect(wrapper).toHaveAttribute('data-overflow', 'true');
    expect(wrapper).toHaveAttribute('data-overflow-end', 'false');
    expect(wrapper).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ring');
    // The table primitive's own overflow container never scrolls or takes focus inside the region.
    expect(container).not.toHaveAttribute('role');
    expect(container).not.toHaveAttribute('tabindex');

    wrapper.scrollLeft = 209;
    fireEvent.scroll(wrapper);
    expect(wrapper).toHaveAttribute('data-overflow-end', 'true');
  });

  it('starts from server-rendered markup without the region', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(<GuidanceTable />);
    const wrapper = host.querySelector('[data-overflow]');

    expect(wrapper).toHaveAttribute('data-overflow', 'false');
    expect(wrapper).not.toHaveAttribute('role');
    expect(wrapper).not.toHaveAttribute('tabindex');
  });
});
