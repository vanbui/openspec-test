import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AiAssistanceNotice } from './ai-assistance-notice';

describe('AiAssistanceNotice (12-UI-SPEC §10, X-11)', () => {
  it('says AI helped and a Security Analyst reviewed, beside a decorative Sparkles', () => {
    const { container } = render(<AiAssistanceNotice />);
    expect(screen.getByText('AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before releasing it to you.')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-sparkles')).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).not.toMatch(/provider|model|proposed/i);
  });
});
