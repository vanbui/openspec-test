import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AiUncitedClaims } from './ai-uncited-claims';

describe('AiUncitedClaims (12-UI-SPEC §4.3)', () => {
  it('asks the analyst to check claims while a proposed field remains, in the warning treatment', () => {
    render(<AiUncitedClaims claims={['Recovery time objectives for the service are not documented.']} reviewOutstanding riskNumber="RSK-005" />);
    const section = screen.getByRole('region', { name: 'Claims to check for RSK-005' });
    expect(section).toHaveClass('bg-warning-subtle', 'border-warning-border');
    expect(section).toHaveTextContent('The AI made these claims without a source in the request or answers. Check each one before you confirm the fields that rely on it.');
    expect(screen.getByRole('listitem')).toHaveTextContent('“Recovery time objectives for the service are not documented.”');
  });

  it('keeps them for reference on the neutral surface once review is done', () => {
    render(<AiUncitedClaims claims={['A claim.']} reviewOutstanding={false} riskNumber="RSK-005" />);
    const section = screen.getByRole('region', { name: 'Claims the AI couldn’t support for RSK-005' });
    expect(section).toHaveClass('bg-surface', 'border-border');
    expect(section).toHaveTextContent('Kept for reference until release.');
  });

  /* axe landmark-unique: each Risk's claims are a region of their own, named by the Risk under the visible heading. */
  it('names each Risk’s region by its Risk, keeping the visible heading', () => {
    render(<>
      <AiUncitedClaims claims={['A claim.']} reviewOutstanding riskNumber="RSK-001" />
      <AiUncitedClaims claims={['Another claim.']} reviewOutstanding riskNumber="RSK-002" />
    </>);
    expect(screen.getByRole('region', { name: 'Claims to check for RSK-001' })).toHaveTextContent('“A claim.”');
    expect(screen.getByRole('region', { name: 'Claims to check for RSK-002' })).toHaveTextContent('“Another claim.”');
    expect(screen.queryByRole('region', { name: 'Claims to check' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 4, name: 'Claims to check' })).toHaveLength(2);
  });

  it('renders claims as text, and nothing without claims', () => {
    const { container, rerender } = render(<AiUncitedClaims claims={['<b>bold</b> claim']} reviewOutstanding riskNumber="RSK-005" />);
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByRole('listitem')).toHaveTextContent('“<b>bold</b> claim”');
    rerender(<AiUncitedClaims claims={[]} reviewOutstanding riskNumber="RSK-005" />);
    expect(container).toBeEmptyDOMElement();
  });
});
