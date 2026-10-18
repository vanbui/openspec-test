import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RiskCardActions } from './risk-card-actions';

/*
 * 16-UI-SPEC §6.1, §12.3 and UI-D4: a Risk card's actions. From 768px they are small pills in the header, in the order
 * Rewrite this risk, History, Withdraw risk; below 768px one circular `Actions for {risk number}` button opens a menu
 * with the same items. Both layouts are in the server's markup and the breakpoint picks one, so a phone never sees the
 * pills before hydration: the tests read each layout by its container and its breakpoint class.
 */
function renderActions({ requestingAnalyst = false, withRewrite = true } = {}) {
  const onHistory = vi.fn();
  const onWithdraw = vi.fn();
  const openRewrite = vi.fn();
  const view = render(
    <RiskCardActions
      onHistory={onHistory}
      onWithdraw={onWithdraw}
      requestingAnalyst={requestingAnalyst}
      rewrite={withRewrite ? { trigger: <button type="button">Rewrite this risk</button>, open: openRewrite } : null}
      riskId="risk-3"
      riskNumber="R-3"
    />,
  );
  const pills = view.container.querySelector<HTMLElement>('[data-card-actions="pills"]')!;
  const menu = view.container.querySelector<HTMLElement>('[data-card-actions="menu"]')!;
  return { onHistory, onWithdraw, openRewrite, pills, menu };
}

describe('RiskCardActions at 1440 (UI-D4)', () => {
  it('renders Rewrite this risk, History and Withdraw risk as pills in that order, each named for the risk', () => {
    const { pills } = renderActions();
    expect(pills).toHaveClass('hidden', 'md:flex');
    expect(within(pills).getAllByRole('button').map((button) => button.textContent)).toEqual(['Rewrite this risk', 'History', 'Withdraw risk']);
    const history = within(pills).getByRole('button', { name: 'History of R-3' });
    const withdraw = within(pills).getByRole('button', { name: 'Withdraw risk R-3' });
    for (const button of [history, withdraw]) {
      expect(button).toHaveAttribute('data-print', 'hidden');
      expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('calls History and Withdraw risk with the control that opened them, so focus can return to it', async () => {
    const user = userEvent.setup();
    const { onHistory, onWithdraw, pills } = renderActions();
    await user.click(within(pills).getByRole('button', { name: 'History of R-3' }));
    expect(onHistory).toHaveBeenCalledWith(within(pills).getByRole('button', { name: 'History of R-3' }));
    await user.click(within(pills).getByRole('button', { name: 'Withdraw risk R-3' }));
    expect(onWithdraw).toHaveBeenCalledWith(within(pills).getByRole('button', { name: 'Withdraw risk R-3' }));
  });

  it('offers the requesting analyst History and Withdraw risk only (§12.3)', () => {
    const { pills } = renderActions({ requestingAnalyst: true });
    expect(within(pills).getAllByRole('button').map((button) => button.textContent)).toEqual(['History', 'Withdraw risk']);
  });
});

describe('RiskCardActions at 375 (UI-D4)', () => {
  it('renders one circular Actions for R-3 button that opens a menu with the same items', async () => {
    const user = userEvent.setup();
    const { menu } = renderActions();
    expect(menu).toHaveClass('md:hidden');
    const buttons = within(menu).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    const trigger = within(menu).getByRole('button', { name: 'Actions for R-3' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveClass('rounded-full', 'size-11');
    await user.click(trigger);
    const items = within(await screen.findByRole('menu')).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Rewrite this risk', 'History', 'Withdraw risk']);
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(['Rewrite this risk: R-3', 'History of R-3', 'Withdraw risk R-3']);
    for (const item of items) expect(item).toHaveClass('min-h-11');
  });

  it('opens the rewrite form, the history and the withdraw form from the menu, handing them the menu button', async () => {
    const user = userEvent.setup();
    const { menu, onHistory, onWithdraw, openRewrite } = renderActions();
    const trigger = within(menu).getByRole('button', { name: 'Actions for R-3' });
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'Rewrite this risk: R-3' }));
    expect(openRewrite).toHaveBeenCalledTimes(1);
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'History of R-3' }));
    expect(onHistory).toHaveBeenCalledWith(trigger);
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'Withdraw risk R-3' }));
    expect(onWithdraw).toHaveBeenCalledWith(trigger);
  });

  it('opens the menu without hiding the rest of the page from assistive technology (axe aria-hidden-focus)', async () => {
    const user = userEvent.setup();
    render(<button type="button">Outside the card</button>);
    const { menu } = renderActions();
    await user.click(within(menu).getByRole('button', { name: 'Actions for R-3' }));
    await screen.findByRole('menu');
    const outside = screen.getByText('Outside the card');
    expect(outside.closest('[aria-hidden="true"]')).toBeNull();
    expect(menu.closest('[aria-hidden="true"]')).toBeNull();
  });

  it.each([
    ['the requesting analyst', { requestingAnalyst: true }],
    ['a card offered no rewrite', { withRewrite: false }],
  ])('drops the rewrite item for %s', async (_case, options) => {
    const user = userEvent.setup();
    const { menu } = renderActions(options);
    await user.click(within(menu).getByRole('button', { name: 'Actions for R-3' }));
    const items = within(await screen.findByRole('menu')).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['History', 'Withdraw risk']);
  });
});
