import { screen, within } from '@testing-library/react';
import { bundle, page, scholarshipSummaries } from '../test/fixtures';
import { mockApi } from '../test/mock-api';
import { renderRoute } from '../test/render';

const mentors = [
  {
    slug: 'evans-kwasi',
    fullName: 'Evans Kwasi',
    headline: 'Engineering student',
    photoUrl: null,
    topics: ['choosing_programme' as const],
    fields: [],
  },
];

const withData = () =>
  mockApi({
    'GET /api/eligibility/requirements': bundle,
    'GET /api/scholarships': page(scholarshipSummaries.slice(0, 1)),
    'GET /api/mentors': page(mentors),
  });

describe('HomePage', () => {
  it('states its purpose with a primary call to check eligibility', () => {
    mockApi({});
    renderRoute('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Find your path from SHS to university and scholarships',
    );
    const cta = screen.getByRole('link', { name: /check your eligibility/i });
    expect(cta).toHaveAttribute('href', '/check-eligibility');
    expect(cta).toHaveClass('bg-green-700');
  });

  it('works out the example from the published requirements, in the browser', async () => {
    const fetchMock = withData();
    renderRoute('/');
    const example = await screen.findByRole('figure');
    expect(example).toHaveTextContent('Example: checking these WASSCE grades');
    expect(within(example).getByText('English Language')).toBeInTheDocument();
    expect(
      within(example).getByText(`Appear eligible for 2 of ${bundle.programmes.length} programmes`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${bundle.programmes.length} programmes with published requirements`),
    ).toBeInTheDocument();
    // Only published data is fetched; no results are sent anywhere.
    for (const [, init] of fetchMock.mock.calls) expect(init?.method ?? 'GET').toBe('GET');
  });

  it('features real scholarships and mentors, linking to them', async () => {
    withData();
    renderRoute('/');
    expect(
      await screen.findByRole('link', {
        name: `View requirements for ${scholarshipSummaries[0]!.name}`,
      }),
    ).toHaveAttribute('href', `/scholarships/${scholarshipSummaries[0]!.slug}`);
    expect(
      screen.getByRole('link', { name: 'Request a session with Evans Kwasi' }),
    ).toHaveAttribute('href', '/mentors/evans-kwasi');
    expect(screen.getByRole('link', { name: 'See all 1 mentor' })).toHaveAttribute(
      'href',
      '/mentors',
    );
    // No promises about response times (OI-05) or verified mentors (OI-04).
    expect(document.body.textContent).not.toMatch(/replies within|verified mentor/i);
  });

  it('hides the scholarship and mentor sections when there are none', async () => {
    mockApi({
      'GET /api/eligibility/requirements': bundle,
      'GET /api/scholarships': page([]),
      'GET /api/mentors': page([]),
    });
    renderRoute('/');
    await screen.findByRole('figure');
    expect(screen.queryByRole('heading', { name: 'Featured verified scholarships' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Talk to a mentor', level: 2 })).toBeNull();
  });

  it('says that eligibility does not guarantee admission, nor mentoring outcomes', async () => {
    withData();
    renderRoute('/');
    const main = screen.getByRole('main');
    expect(
      within(main).getByText(/final admission decisions are made by the institution/i),
    ).toBeInTheDocument();
    expect(
      await within(main).findByText(/cannot guarantee admission or scholarship outcomes/i),
    ).toBeInTheDocument();
  });

  it('never calls an option "best for you"', () => {
    mockApi({});
    renderRoute('/');
    expect(document.body.textContent).not.toMatch(/best for you/i);
  });

  it('sets the page title', () => {
    mockApi({});
    renderRoute('/');
    expect(document.title).toBe(
      'Xcel – Find university programmes and scholarships that match your WASSCE results.',
    );
  });
});
