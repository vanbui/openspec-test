import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../app/actions/session', () => ({ setDevelopmentRole: vi.fn() }));

import { RoleSwitcher } from './role-switcher';

describe('RoleSwitcher', () => {
  it('keeps its label on every copy, so the navigation sheet copy is named while the sidebar copy exists', () => {
    // The shell renders the switcher in the sidebar (hidden below lg) and again in the navigation
    // sheet. A shared id pointed the sheet's label at the hidden sidebar select, leaving the
    // visible select unnamed.
    render(
      <>
        <RoleSwitcher role="Security Analyst" />
        <RoleSwitcher role="Security Analyst" />
      </>,
    );

    const selects = screen.getAllByRole('combobox', { name: 'Development role' });
    expect(selects).toHaveLength(2);
    expect(new Set(selects.map((select) => select.id)).size).toBe(2);
    for (const select of selects) expect(select).toHaveValue('Security Analyst');
  });
});
