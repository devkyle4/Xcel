import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { bundle, catalogueRoutes } from '../test/fixtures';
import { mockApi } from '../test/mock-api';
import { renderRoute } from '../test/render';

async function enterResults(user: ReturnType<typeof userEvent.setup>) {
  const core: [string, string][] = [
    ['English Language', 'B3'],
    ['Core Mathematics', 'C4'],
    ['Integrated Science', 'C5'],
    ['Social Studies', 'B2'],
  ];
  for (const [subject, grade] of core) {
    await user.selectOptions(await screen.findByLabelText(subject), grade);
  }
  const electives: [string, string][] = [
    ['PHYSICS', 'C6'],
    ['ELECTIVE_MATHS', 'B3'],
    ['BIOLOGY', 'C4'],
    ['CHEMISTRY', 'C5'],
  ];
  for (const [i, [subject, grade]] of electives.entries()) {
    await user.selectOptions(screen.getByLabelText(`Elective subject ${i + 1}`), subject);
    await user.selectOptions(screen.getByLabelText(`Grade for elective subject ${i + 1}`), grade);
  }
}

describe('checking eligibility', () => {
  it('goes from results entry through review to explained results, without sending results anywhere', async () => {
    const fetchMock = mockApi({ ...catalogueRoutes, 'GET /api/eligibility/requirements': bundle });
    const user = userEvent.setup();
    const router = renderRoute('/check-eligibility');

    await enterResults(user);
    await user.click(screen.getByRole('button', { name: 'Review my results' }));

    const review = screen.getByRole('table');
    expect(within(review).getAllByRole('row')).toHaveLength(9);
    expect(within(review).getByRole('row', { name: /Physics C6/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'See my results' }));

    // Grouped by status, best first.
    const eligible = await screen.findByRole('region', { name: /appear eligible for/ });
    expect(router.state.location.pathname).toBe('/check-eligibility/results');
    expect(within(eligible).getByRole('link', { name: 'BSc Nursing' })).toBeInTheDocument();
    const likely = screen.getByRole('region', { name: /Likely eligible/ });
    expect(within(likely).getByText(/Pass the entrance interview/)).toBeInTheDocument();
    const notMet = screen.getByRole('region', { name: /Requirements not met/ });
    expect(within(notMet).getByText('Not met:')).toBeInTheDocument();

    // "See why" explains each requirement with the student's grade and the threshold.
    const seeWhy = within(notMet).getByRole('button', { name: 'See why' });
    await user.click(seeWhy);
    expect(seeWhy).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(notMet).getByText('You have C6 in Physics; B3 or better is required.'),
    ).toBeInTheDocument();
    expect(within(notMet).getByText('You have B3 in Elective Mathematics.')).toBeInTheDocument();

    // Results stay in this tab's session storage and never reach the server.
    expect(JSON.parse(sessionStorage.getItem('xcel:wassce-results')!)).toMatchObject({
      PHYSICS: 'C6',
    });
    for (const [input, init] of fetchMock.mock.calls) {
      expect(init?.method ?? 'GET').toBe('GET');
      expect(init?.body).toBeUndefined();
      expect(String(input)).not.toMatch(/PHYSICS|C6|B3/);
    }
    expect(fetchMock.mock.calls.map(([input]) => String(input)).sort()).toEqual([
      '/api/eligibility/requirements',
      '/api/grades',
      '/api/subjects',
    ]);
  });

  it('filters results by status', async () => {
    mockApi({ ...catalogueRoutes, 'GET /api/eligibility/requirements': bundle });
    const { resultsStore } = await import('../lib/results-store');
    const { studentResults } = await import('../test/fixtures');
    resultsStore.set(studentResults);
    const user = userEvent.setup();
    renderRoute('/check-eligibility/results');

    await user.selectOptions(await screen.findByLabelText('Show'), 'Eligible');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'BSc Nursing' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('asks for a grade for every chosen subject', async () => {
    mockApi(catalogueRoutes);
    const user = userEvent.setup();
    renderRoute('/check-eligibility');
    await user.selectOptions(await screen.findByLabelText('Elective subject 1'), 'PHYSICS');
    await user.click(screen.getByRole('button', { name: 'Review my results' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose your grade for Physics.');
    expect(screen.getByLabelText('Grade for elective subject 1')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('warns, without blocking, when core subjects are missing', async () => {
    mockApi(catalogueRoutes);
    const user = userEvent.setup();
    renderRoute('/check-eligibility');
    await user.selectOptions(await screen.findByLabelText('English Language'), 'B3');
    await user.click(screen.getByRole('button', { name: 'Review my results' }));
    expect(
      screen.getByText(/Core Mathematics, Integrated Science, Social Studies/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See my results' })).toBeEnabled();
  });

  it('does not offer the same elective twice', async () => {
    mockApi(catalogueRoutes);
    const user = userEvent.setup();
    renderRoute('/check-eligibility');
    await user.selectOptions(await screen.findByLabelText('Elective subject 1'), 'PHYSICS');
    const second = screen.getByLabelText('Elective subject 2');
    expect(within(second).queryByRole('option', { name: 'Physics' })).toBeNull();
  });

  it('clears results and returns to entry', async () => {
    mockApi({ ...catalogueRoutes, 'GET /api/eligibility/requirements': bundle });
    const { resultsStore } = await import('../lib/results-store');
    resultsStore.set({ ENGLISH: 'A1' });
    const user = userEvent.setup();
    const router = renderRoute('/check-eligibility/results');
    await user.click(await screen.findByRole('button', { name: 'Clear my results' }));
    expect(sessionStorage.getItem('xcel:wassce-results')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Review my results' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/check-eligibility');
  });

  it('sends visitors without results to the entry form', async () => {
    mockApi(catalogueRoutes);
    const router = renderRoute('/check-eligibility/results');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Check your eligibility' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/check-eligibility');
  });
});
