import { screen, within } from '@testing-library/react';
import { renderRoute } from './test/render';

describe('routes', () => {
  it.each([
    ['/universities', 'Universities'],
    ['/scholarships', 'Scholarships'],
    ['/mentors', 'Find a Mentor'],
    ['/check-eligibility', 'Check your eligibility'],
    ['/about', 'About Xcel'],
    ['/disclaimer', 'Disclaimer'],
    ['/contact', 'Contact'],
    ['/no-such-page', 'Page not found'],
  ])('%s shows "%s"', async (path, heading) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('puts About, Disclaimer and Contact in the footer', () => {
    renderRoute('/');
    const footer = screen.getByRole('navigation', { name: 'Footer' });
    expect(
      within(footer)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['About', 'Disclaimer', 'Contact']);
  });

  it('offers a skip link to the main content', () => {
    renderRoute('/');
    expect(screen.getAllByRole('link')[0]).toHaveTextContent('Skip to main content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});
