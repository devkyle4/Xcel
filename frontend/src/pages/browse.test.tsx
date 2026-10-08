import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resultsStore } from '../lib/results-store';
import {
  bundle,
  page,
  programmeSummaries,
  scholarshipSummaries,
  studentResults,
} from '../test/fixtures';
import { mockApi } from '../test/mock-api';
import { renderRoute } from '../test/render';

const requested = (fetchMock: ReturnType<typeof mockApi>, path: string) =>
  fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.startsWith(path));

describe('UniversitiesPage and university detail', () => {
  it('lists universities and links to their pages', async () => {
    mockApi({
      'GET /api/universities': page([
        {
          slug: 'knust',
          name: 'Kwame Nkrumah University of Science and Technology',
          shortName: 'KNUST',
          institutionType: 'public_university',
          region: 'ashanti',
          town: 'Kumasi',
          logoUrl: null,
        },
      ]),
    });
    renderRoute('/universities');
    expect(
      await screen.findByRole('link', {
        name: 'Kwame Nkrumah University of Science and Technology',
      }),
    ).toHaveAttribute('href', '/universities/knust');
    expect(screen.getByText('Public university · Kumasi, Ashanti')).toBeInTheDocument();
  });

  const knust = {
    slug: 'knust',
    name: 'KNUST',
    shortName: 'KNUST',
    institutionType: 'public_university',
    region: 'ashanti',
    town: 'Kumasi',
    logoUrl: null,
    description: 'A public university in Kumasi.',
    websiteUrl: 'https://knust.example',
    admissionsUrl: null,
    verification: null,
    programmes: programmeSummaries,
    scholarships: [scholarshipSummaries[0]],
  };

  it('shows a university with its programmes by field, scholarships and links', async () => {
    mockApi({ 'GET /api/universities/knust': knust, 'GET /api/eligibility/requirements': bundle });
    const user = userEvent.setup();
    renderRoute('/universities/knust');
    expect(await screen.findByRole('heading', { level: 1, name: 'KNUST' })).toBeInTheDocument();
    expect(screen.getByText('Public university · Kumasi, Ashanti Region')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Official website/ })).toHaveAttribute(
      'href',
      'https://knust.example',
    );

    expect(
      screen.getByRole('heading', { name: `Programmes (${programmeSummaries.length})` }),
    ).toBeInTheDocument();
    const engineering = screen.getByRole('region', { name: 'Engineering' });
    expect(
      within(engineering).getByRole('link', { name: 'BSc Computer Engineering' }),
    ).toHaveAttribute('href', `/programmes/${programmeSummaries[0]!.id}`);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Engineering',
      'Health',
      'Law',
      'Merit Award',
    ]);
    // Without results, students are invited to check eligibility.
    expect(screen.getByRole('link', { name: 'Check eligibility' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Find a programme'), 'nurs');
    expect(screen.getByRole('link', { name: 'BSc Nursing' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'LLB Law' })).toBeNull();
    expect(screen.getByText('1 of 3 programmes match “nurs”')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Merit Award' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Report incorrect information' }),
    ).toBeInTheDocument();
  });

  it("shows the student's status for each programme, worked out in the browser", async () => {
    const fetchMock = mockApi({
      'GET /api/universities/knust': knust,
      'GET /api/eligibility/requirements': bundle,
    });
    resultsStore.set(studentResults);
    renderRoute('/universities/knust');
    const engineering = (
      await screen.findByRole('link', { name: 'BSc Computer Engineering' })
    ).closest('article')!;
    expect(await within(engineering).findByText('Not eligible')).toBeInTheDocument();
    // Students are told where the statuses come from and how to change them.
    expect(screen.getByText(/based on the results you entered this session/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change or clear your results' })).toHaveAttribute(
      'href',
      '/check-eligibility',
    );
    // Results never leave the browser.
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).not.toMatch(/ENGLISH|results/);
    }
  });

  it('sends the old programme browse address to the universities page', async () => {
    mockApi({ 'GET /api/universities': page([]) });
    const router = renderRoute('/programmes');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Universities' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/universities');
  });

  it('shows "page not found" for unknown universities', async () => {
    mockApi({});
    renderRoute('/universities/nowhere');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});

describe('ScholarshipsPage and scholarship detail', () => {
  const routes = {
    'GET /api/scholarships/filters': {
      fields: ['Engineering'],
      eligibilityCategories: ['Merit'],
      locations: ['Ghana'],
    },
    'GET /api/scholarships': page(scholarshipSummaries),
  };

  it('shows deadlines and availability, marking closed scholarships clearly', async () => {
    mockApi(routes);
    renderRoute('/scholarships');
    const open = (await screen.findByRole('link', { name: 'Merit Award' })).closest('article')!;
    expect(within(open).getByText('Open')).toBeInTheDocument();
    expect(within(open).getByText('Application deadline: 31 December 2026')).toBeInTheDocument();

    const closed = screen.getByRole('link', { name: 'Old Award' }).closest('article')!;
    expect(within(closed).getByText('Closed')).toHaveClass('text-red-800');
    expect(within(closed).getByText('Closed on 31 January 2026')).toHaveClass('text-red-800');
  });

  it('filters for open or upcoming scholarships', async () => {
    const fetchMock = mockApi(routes);
    const user = userEvent.setup();
    renderRoute('/scholarships');
    await user.selectOptions(await screen.findByLabelText('Status'), 'open,upcoming');
    expect(requested(fetchMock, '/api/scholarships?')).toContain(
      '/api/scholarships?availability=open%2Cupcoming&page=1&pageSize=20',
    );
  });

  it('explains that meeting the criteria is not an award, and links to the provider for the next round once closed', async () => {
    mockApi({
      'GET /api/scholarships/old-award': {
        ...scholarshipSummaries[1],
        description: null,
        providerUrl: 'https://fundb.example.org',
        applicationUrl: null,
        university: null,
        requirements: ['Ghanaian citizen'],
        verification: null,
      },
    });
    renderRoute('/scholarships/old-award');
    expect(await screen.findByRole('heading', { level: 1, name: 'Old Award' })).toBeInTheDocument();
    expect(screen.getByText('Closed on 31 January 2026')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Apply/ })).toBeNull();
    expect(
      screen.getByRole('link', {
        name: 'Visit the official website for the next round (opens in a new tab)',
      }),
    ).toHaveAttribute('href', 'https://fundb.example.org');
    expect(screen.getByText('Ghanaian citizen')).toBeInTheDocument();
    expect(screen.getByText(/does not mean you will receive this scholarship/)).toBeInTheDocument();
  });

  it('links every scholarship card to its official site', async () => {
    mockApi(routes);
    renderRoute('/scholarships');
    const open = (await screen.findByRole('link', { name: 'Merit Award' })).closest('article')!;
    expect(
      within(open).getByRole('link', {
        name: 'Apply on the official website (opens in a new tab)',
      }),
    ).toHaveAttribute('href', 'https://apply.example.org/merit');
    const closed = screen.getByRole('link', { name: 'Old Award' }).closest('article')!;
    expect(
      within(closed).getByRole('link', { name: 'Official website (opens in a new tab)' }),
    ).toHaveAttribute('href', 'https://fundb.example.org');
  });
});
