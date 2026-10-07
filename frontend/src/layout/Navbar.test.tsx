import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';

describe('Navbar', () => {
  it('shows the logo and the five items in order, with Check Eligibility last', () => {
    renderRoute('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Xcel – home',
      'Programmes',
      'Universities',
      'Scholarships',
      'Find a Mentor',
      'Check Eligibility',
    ]);
    expect(links[0]).toHaveAttribute('href', '/');
    expect(links.at(-1)).toHaveAttribute('href', '/check-eligibility');
    expect(links.at(-1)).toHaveClass('bg-green-700');
  });

  it('never links to the admin area', () => {
    renderRoute('/');
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/admin/);
    }
  });

  it('marks the current page', async () => {
    renderRoute('/scholarships');
    // The page is code-split, so the app renders once it has loaded.
    const link = within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('link', {
      name: 'Scholarships',
    });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('opens and closes the mobile menu, keeping Check Eligibility outside it', async () => {
    const user = userEvent.setup();
    renderRoute('/');
    const toggle = screen.getByRole('button', { name: 'Menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('mobile-menu')).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = document.getElementById('mobile-menu')!;
    expect(
      within(menu)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Programmes', 'Universities', 'Scholarships', 'Find a Mentor']);

    await user.keyboard('{Escape}');
    expect(document.getElementById('mobile-menu')).toBeNull();
    expect(toggle).toHaveFocus();
  });

  it('closes the mobile menu after choosing a page', async () => {
    const user = userEvent.setup();
    const router = renderRoute('/');
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(
      within(document.getElementById('mobile-menu')!).getByRole('link', { name: 'Universities' }),
    );
    expect(router.state.location.pathname).toBe('/universities');
    expect(document.getElementById('mobile-menu')).toBeNull();
  });
});
