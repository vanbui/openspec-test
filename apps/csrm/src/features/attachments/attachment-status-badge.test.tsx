import { render, screen } from '@testing-library/react';
import { ArchiveXIcon, FileXIcon, ShieldCheckIcon, ShieldEllipsisIcon, ShieldXIcon, type LucideIcon } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { statusPresentation } from '@/components/csrm/status-badge';

import { AttachmentStatusBadge, attachmentStatusIcons } from './attachment-status-badge';
import { attachmentStates } from './attachments-schema';

/*
 * 14-UI-SPEC §3.4 (X-21; UI-D14) and IN-506: the file states' badge. The one status mapping keeps each state's label and
 * tone and names its icon; the attachments feature resolves the name, so only the routes that render a file carry the
 * five file icons.
 */
const icons: Record<(typeof attachmentStates)[number], LucideIcon> = {
  available: ShieldCheckIcon,
  pending: ShieldEllipsisIcon,
  blocked: ShieldXIcon,
  unavailable: FileXIcon,
  removed: ArchiveXIcon,
};

function iconMarkup(Icon: LucideIcon) {
  return renderToStaticMarkup(<Icon aria-hidden="true" />);
}

describe('the file state badge (§3.4; IN-506)', () => {
  it('resolves each icon the status mapping names to the icon §3.4 gives it', () => {
    for (const value of attachmentStates) {
      expect(attachmentStatusIcons[statusPresentation.attachment[value].iconName], value).toBe(icons[value]);
    }
  });

  it.each(attachmentStates.filter((value) => value !== 'available'))('renders %s as the neutral badge with its icon and the mapping’s label', (value) => {
    render(<AttachmentStatusBadge value={value} />);
    const label = statusPresentation.attachment[value].label;
    const badge = screen.getByText(label, { exact: true });
    expect(badge).toHaveAttribute('data-slot', 'badge');
    expect(badge).toHaveAttribute('data-tone', 'neutral');
    expect(badge).toHaveAttribute('data-variant', 'outline');
    expect(badge.innerHTML).toBe(`${iconMarkup(icons[value])}${label}`);
  });

  it('renders Blocked with its shield, never a danger badge', () => {
    render(<AttachmentStatusBadge value="blocked" />);
    const badge = screen.getByText('Blocked', { exact: true });
    expect(badge).toHaveAttribute('data-tone', 'neutral');
    expect(badge.innerHTML).toBe(`${iconMarkup(ShieldXIcon)}Blocked`);
  });
});
