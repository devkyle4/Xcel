import { fireEvent, render, screen } from '@testing-library/react';
import { ProviderLogo } from './ProviderLogo';

describe('ProviderLogo', () => {
  it('shows the logo as a decorative image', () => {
    const { container } = render(
      <ProviderLogo src="/logos/gsa.webp" name="Ghana Scholarships Authority" />,
    );
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', '/logos/gsa.webp');
    expect(img).toHaveAttribute('alt', '');
  });

  it('falls back to initials without a logo', () => {
    render(<ProviderLogo src={null} name="Ghana Education Trust Fund (GETFund)" />);
    expect(screen.getByTestId('logo-fallback')).toHaveTextContent('GE');
  });

  it('falls back to initials when the logo fails to load', () => {
    const { container } = render(
      <ProviderLogo src="/logos/missing.webp" name="Thrive and Shine LBG" />,
    );
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByTestId('logo-fallback')).toHaveTextContent('TS');
  });
});
