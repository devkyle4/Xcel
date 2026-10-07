import { ELIGIBILITY_STATUSES } from '@xcel/shared';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['Eligible', 'Eligible', ['bg-green-100', 'text-green-900']],
    ['LikelyEligible', 'Likely eligible', ['bg-green-50', 'text-green-800', 'border-green-300']],
    ['NeedsReview', 'Needs review', ['bg-blue-100', 'text-blue-900']],
    ['NotEligible', 'Not eligible', ['bg-red-100', 'text-red-800']],
  ] as const)('shows %s with its label, icon and colours', (status, label, classes) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(label);
    expect(badge).toHaveClass(...classes);
    // The icon is decorative; the text label carries the meaning.
    const icon = badge.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('covers every engine status', () => {
    for (const status of ELIGIBILITY_STATUSES) {
      const { unmount } = render(<StatusBadge status={status} />);
      unmount();
    }
  });

  it('has a strong Not Eligible variant with white text on red-700', () => {
    render(<StatusBadge status="NotEligible" strong />);
    expect(screen.getByText('Not eligible')).toHaveClass('bg-red-700', 'text-white');
  });

  it('is not interactive', () => {
    render(<StatusBadge status="NotEligible" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
