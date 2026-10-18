/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { toastAction } from './toast-action';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('toastAction (X-14)', () => {
  it('leaves the toast region before it acts, then acts once', () => {
    document.body.innerHTML = '<section data-sonner-toaster><button id="undo">Undo</button></section><button id="page">Page</button>';
    const undo = document.getElementById('undo') as HTMLButtonElement;
    undo.focus();
    const order: string[] = [];
    undo.addEventListener('blur', () => order.push('left'));
    const act = vi.fn(() => order.push('acted'));

    const action = toastAction('Undo', act);
    expect(action.label).toBe('Undo');
    action.onClick({} as never);

    expect(act).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['left', 'acted']);
    expect(document.activeElement).not.toBe(undo);
  });

  it('leaves focus where it is when it sits outside a toast', () => {
    document.body.innerHTML = '<button id="page">Page</button>';
    const page = document.getElementById('page') as HTMLButtonElement;
    page.focus();
    const act = vi.fn();
    toastAction('Try again', act).onClick({} as never);
    expect(act).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(page);
  });
});
