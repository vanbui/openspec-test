import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileField } from './file-field';

const hint = 'PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG · up to 25 MB each · 20 more can be added to this request';

function field(onFiles = vi.fn()) {
  const view = render(<><FileField hint={hint} label="Add files" onFiles={onFiles} /><p>Elsewhere on the page</p></>);
  return { ...view, onFiles };
}

/** A drag event carrying files, as the browser sends one: jsdom has no DataTransfer, so the test gives it one. */
function fileDrag(type: 'dragenter' | 'dragover' | 'dragleave' | 'drop', files: File[] = []): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files, dropEffect: 'copy' } });
  return event;
}

const region = () => screen.getByRole('button', { name: 'Choose files' }).closest('[data-file-drop]') as HTMLElement;

afterEach(() => {
  vi.clearAllMocks();
});

/* X-19 (14-UI-SPEC §1.1; UI-D30): the file field and its drop target. */
describe('the file field (X-19)', () => {
  /* IN-407: motion takes the direction's tokens; the drop region's colour change is control state, `--duration-micro`. */
  it('eases the drop region’s colour at the direction’s micro duration token, with no raw duration', () => {
    field();
    const classes = region().className.split(/\s+/);
    expect(classes).toContain('duration-(--duration-micro)');
    expect(classes.filter((name) => /^duration-\d+$/.test(name))).toEqual([]);
  });

  it('opens the chooser from Choose files, labelled by the field, and hands over the files chosen in order', async () => {
    const { onFiles } = field();
    const input = screen.getByLabelText('Add files');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('multiple');
    expect(input).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: 'Choose files' })).toHaveAccessibleDescription(hint);
    const files = [new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')];
    await userEvent.setup().upload(input, files);
    expect(onFiles).toHaveBeenCalledWith(files);
  });

  it('shows the drag line from 768px only', () => {
    field();
    const line = screen.getByText('Drag files here, or');
    expect(line).toHaveClass('hidden');
    expect(line).toHaveClass('md:inline');
  });

  it('switches to its active state while files are dragged over it, and takes the files dropped on it', () => {
    const { onFiles } = field();
    expect(region()).toHaveAttribute('data-drag-active', 'false');
    fireEvent(region(), fileDrag('dragenter'));
    expect(region()).toHaveAttribute('data-drag-active', 'true');
    expect(region()).toHaveClass('border-foreground');
    const files = [new File(['a'], 'a.pdf')];
    const drop = fileDrag('drop', files);
    fireEvent(region(), drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(onFiles).toHaveBeenCalledWith(files);
    expect(region()).toHaveAttribute('data-drag-active', 'false');
  });

  /* WR-504: while the form holding the field saves, the field takes no files, by the button, the input or a drop. */
  it('takes no files while disabled: Choose files and the input are disabled, and a drop is refused, never handed over or opened', () => {
    const onFiles = vi.fn();
    render(<FileField disabled hint={hint} label="Add files" onFiles={onFiles} />);
    expect(screen.getByRole('button', { name: 'Choose files' })).toBeDisabled();
    expect(screen.getByLabelText('Add files')).toBeDisabled();
    const over = fileDrag('dragover');
    fireEvent(region(), over);
    expect(over.defaultPrevented).toBe(true);
    expect(region()).toHaveAttribute('data-drag-active', 'false');
    const drop = fileDrag('drop', [new File(['a'], 'a.pdf')]);
    fireEvent(region(), drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('ignores files dropped anywhere else on the page, so the browser never opens one (UI-D30)', () => {
    const { onFiles } = field();
    const over = fileDrag('dragover');
    fireEvent(screen.getByText('Elsewhere on the page'), over);
    expect(over.defaultPrevented).toBe(true);
    const drop = fileDrag('drop', [new File(['a'], 'a.pdf')]);
    fireEvent(screen.getByText('Elsewhere on the page'), drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('leaves the page’s drops alone once the field has gone', () => {
    const { unmount } = field();
    unmount();
    const drop = fileDrag('drop', [new File(['a'], 'a.pdf')]);
    window.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(false);
  });
});
