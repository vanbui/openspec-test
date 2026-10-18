import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hashTargetId, landOn, useHashLanding } from './use-hash-landing';

/*
 * In-page link destinations on a streamed route (D1 and D3 of the 13-19 walk; Phase 10 UI-D27): the owner of a destination
 * lands on it once it has mounted, on a later `hashchange`, and after a plain click on a link to this very page.
 */

const scrollIntoView = vi.fn();
const original = Element.prototype.scrollIntoView;

beforeEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  Element.prototype.scrollIntoView = original;
  scrollIntoView.mockReset();
  window.history.replaceState(null, '', '/');
});

function Owner({ land }: { land: (id: string) => void }) {
  useHashLanding(land);
  return null;
}

describe('hashTargetId', () => {
  it('reads the id a fragment names, decoded, and nothing for an empty or undecodable one', () => {
    expect(hashTargetId('#notes')).toBe('notes');
    expect(hashTargetId('#note-note%209')).toBe('note-note 9');
    expect(hashTargetId('note-1')).toBe('note-1');
    expect(hashTargetId('#')).toBeNull();
    expect(hashTargetId('')).toBeNull();
    expect(hashTargetId('#%E0%A4%A')).toBeNull();
  });
});

describe('landOn', () => {
  it('scrolls a focusable target into view and focuses it without a second scroll', () => {
    render(<article id="note-1" tabIndex={-1}>A note</article>);
    const target = document.getElementById('note-1')!;
    const focus = vi.spyOn(target, 'focus');
    landOn(target);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(target).toHaveFocus();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('focuses the heading that names a region that cannot take focus itself', () => {
    render(<div id="notes"><section><h2 tabIndex={-1}>Notes</h2><p>Body</p></section></div>);
    landOn(document.getElementById('notes')!);
    expect(screen.getByRole('heading', { name: 'Notes' })).toHaveFocus();
  });

  it('focuses a field target', () => {
    render(<textarea aria-label="Add a note" id="note-composer" />);
    landOn(document.getElementById('note-composer')!);
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveFocus();
  });
});

describe('useHashLanding', () => {
  it('hands the owner the URL’s fragment once it has mounted, and every later hashchange', async () => {
    window.history.replaceState(null, '', '/app/requests/r1#notes');
    const land = vi.fn();
    render(<Owner land={land} />);
    expect(land).toHaveBeenCalledWith('notes');
    window.history.replaceState(null, '', '/app/requests/r1#note-n2');
    await act(async () => window.dispatchEvent(new HashChangeEvent('hashchange')));
    expect(land).toHaveBeenLastCalledWith('note-n2');
  });

  it('hands nothing without a fragment', () => {
    const land = vi.fn();
    render(<Owner land={land} />);
    expect(land).not.toHaveBeenCalled();
  });

  it('hands the fragment of a plain click on a link to this page, after the router has moved, and nothing for any other click', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/app/review/requests/r1');
    const land = vi.fn();
    const stay = (event: { preventDefault: () => void }) => event.preventDefault();
    render(
      <>
        <Owner land={land} />
        <a href="/app/review/requests/r1#note-n1" onClick={stay}>Same page</a>
        <a href="/app/review/requests/r2#note-n1" onClick={stay}>Another request</a>
        <a href="/app/review/requests/r1#note-n1" onClick={stay} target="_blank">New tab</a>
      </>,
    );
    await user.click(screen.getByRole('link', { name: 'Another request' }));
    await user.click(screen.getByRole('link', { name: 'New tab' }));
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: 'Same page' }));
    await user.keyboard('{/Control}');
    await act(async () => new Promise((done) => setTimeout(done, 40)));
    expect(land).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: 'Same page' }));
    expect(land).not.toHaveBeenCalled();
    await waitFor(() => expect(land).toHaveBeenCalledWith('note-n1'));
  });

  it('stops listening once the owner leaves', async () => {
    window.history.replaceState(null, '', '/app/requests/r1');
    const land = vi.fn();
    const { unmount } = render(<Owner land={land} />);
    unmount();
    window.history.replaceState(null, '', '/app/requests/r1#notes');
    await act(async () => window.dispatchEvent(new HashChangeEvent('hashchange')));
    expect(land).not.toHaveBeenCalled();
  });
});
