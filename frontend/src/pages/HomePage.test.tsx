import { screen, within } from '@testing-library/react';
import { renderRoute } from '../test/render';

describe('HomePage', () => {
  it('states its purpose with a primary call to check eligibility', () => {
    renderRoute('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Find university programmes that match your WASSCE results',
    );
    const cta = screen.getByRole('link', { name: /check your eligibility/i });
    expect(cta).toHaveAttribute('href', '/check-eligibility');
    expect(cta).toHaveClass('bg-green-700');
  });

  it('links to universities, scholarships and mentors', () => {
    renderRoute('/');
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'Explore universities' })).toHaveAttribute(
      'href',
      '/universities',
    );
    expect(within(main).getByRole('link', { name: 'Find scholarships' })).toHaveAttribute(
      'href',
      '/scholarships',
    );
    expect(within(main).getByRole('link', { name: 'Talk to a mentor' })).toHaveAttribute(
      'href',
      '/mentors',
    );
  });

  it('says that eligibility does not guarantee admission', () => {
    renderRoute('/');
    expect(
      within(screen.getByRole('main')).getByText(
        /final admission decisions are made by the institution/i,
      ),
    ).toBeInTheDocument();
  });

  it('never calls an option "best for you"', () => {
    renderRoute('/');
    expect(document.body.textContent).not.toMatch(/best for you/i);
  });

  it('sets the page title', async () => {
    renderRoute('/');
    expect(document.title).toBe(
      'Xcel – Find university programmes and scholarships that match your WASSCE results.',
    );
  });
});
