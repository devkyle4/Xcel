import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resultsStore } from '../lib/results-store';
import {
  bundle,
  catalogueRoutes,
  page,
  programmeSummaries,
  scholarshipSummaries,
  studentResults,
} from '../test/fixtures';
import { mockApi } from '../test/mock-api';
import { renderRoute } from '../test/render';

const programmeFilters = {
  fields: ['Engineering', 'Health', 'Law'],
  universities: [
    { slug: 'knust', name: 'KNUST' },
    { slug: 'ug', name: 'University of Ghana' },
  ],
};

const requested = (fetchMock: ReturnType<typeof mockApi>, path: string) =>
  fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.startsWith(path));

describe('ProgrammesPage', () => {
  const routes = {
    ...catalogueRoutes,
    'GET /api/programmes/filters': programmeFilters,
    'GET /api/programmes': (url: URL) =>
      url.searchParams.get('q') === 'nothing'
        ? page([])
        : page(programmeSummaries, 45, Number(url.searchParams.get('page') ?? 1)),
    'GET /api/eligibility/requirements': bundle,
  };

  it('searches and filters through the URL', async () => {
    const fetchMock = mockApi(routes);
    const user = userEvent.setup();
    const router = renderRoute('/programmes');
    expect(await screen.findByText('Showing 1–20 of 45 programmes')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search programmes'), 'nursing');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(router.state.location.search).toBe('?q=nursing');

    await user.selectOptions(screen.getByLabelText('University'), 'ug');
    expect(new URLSearchParams(router.state.location.search).get('university')).toBe('ug');
    expect(requested(fetchMock, '/api/programmes?')).toContain(
      '/api/programmes?q=nursing&university=ug&page=1&pageSize=20',
    );
  });

  it('paginates', async () => {
    const fetchMock = mockApi(routes);
    const user = userEvent.setup();
    renderRoute('/programmes');
    await user.click(await screen.findByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    expect(requested(fetchMock, '/api/programmes?')).toContain(
      '/api/programmes?page=2&pageSize=20',
    );
  });

  it('explains when nothing matches and offers to clear filters', async () => {
    mockApi(routes);
    const user = userEvent.setup();
    const router = renderRoute('/programmes?q=nothing');
    expect(await screen.findByText(/No programmes match your search/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear search and filters' })[0]!);
    expect(router.state.location.search).toBe('');
  });

  it('invites students without results to enter them', async () => {
    mockApi(routes);
    renderRoute('/programmes');
    expect(await screen.findByRole('link', { name: 'Enter your results' })).toHaveAttribute(
      'href',
      '/check-eligibility',
    );
    expect(screen.queryByLabelText('Only show programmes I appear eligible for')).toBeNull();
  });

  it('shows statuses and can list only programmes the student appears eligible for', async () => {
    mockApi(routes);
    resultsStore.set(studentResults);
    const user = userEvent.setup();
    renderRoute('/programmes');

    const engineering = (
      await screen.findByRole('link', { name: 'BSc Computer Engineering' })
    ).closest('article')!;
    expect(await within(engineering).findByText('Not eligible')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Only show programmes I appear eligible for'));
    const names = screen
      .getAllByRole('article')
      .map((a) => within(a).getAllByRole('link')[0]!.textContent);
    expect(names).toEqual(['BSc Nursing', 'LLB Law']);
    expect(screen.getByText('Showing 1–2 of 2 programmes')).toBeInTheDocument();
  });
});

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

  it('shows a university with its programmes, scholarships and links', async () => {
    mockApi({
      'GET /api/universities/knust': {
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
        programmes: [programmeSummaries[0]],
        scholarships: [scholarshipSummaries[0]],
      },
    });
    renderRoute('/universities/knust');
    expect(await screen.findByRole('heading', { level: 1, name: 'KNUST' })).toBeInTheDocument();
    expect(screen.getByText('Public university · Kumasi, Ashanti Region')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Official website/ })).toHaveAttribute(
      'href',
      'https://knust.example',
    );
    expect(screen.getByRole('link', { name: 'BSc Computer Engineering' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Merit Award' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Report incorrect information' }),
    ).toBeInTheDocument();
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
