import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resultsStore } from '../lib/results-store';
import { bundle, catalogueRoutes, programmeDetail, studentResults } from '../test/fixtures';
import { mockApi } from '../test/mock-api';
import { renderRoute } from '../test/render';

const path = `/programmes/${programmeDetail.id}`;
const routes = {
  ...catalogueRoutes,
  [`GET /api/programmes/${programmeDetail.id}`]: programmeDetail,
  'GET /api/eligibility/requirements': bundle,
};

describe('ProgrammeDetailPage', () => {
  it('shows the admission cycle, verification, source, deadline and application link', async () => {
    mockApi(routes);
    renderRoute(path);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'BSc Computer Engineering' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Requirements for the 2026/2027 admission cycle' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Verified on 1 September 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /KNUST Admission Brochure/ })).toHaveAttribute(
      'href',
      'https://knust.example/brochure',
    );
    expect(screen.getByText('Application deadline: 31 August 2026')).toBeInTheDocument();
    const apply = screen.getByRole('link', { name: /Apply on the official website/ });
    expect(apply).toHaveAttribute('href', 'https://apply.knust.example');
    expect(apply).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      within(screen.getByRole('main')).getByText(
        /final admission decisions are made by the institution/i,
      ),
    ).toBeInTheDocument();
  });

  it('lists requirements in plain language and invites a check when no results are entered', async () => {
    mockApi(routes);
    renderRoute(path);
    expect(await screen.findByText('Physics: B3 or better')).toBeInTheDocument();
    expect(screen.queryByText('Not met')).toBeNull();
    expect(
      screen.getByRole('link', { name: /Check these requirements against your results/ }),
    ).toHaveAttribute('href', '/check-eligibility');
  });

  it('compares each requirement with entered results and suggests options to explore', async () => {
    mockApi(routes);
    resultsStore.set(studentResults);
    renderRoute(path);
    expect(
      await screen.findByText('You have C6 in Physics; B3 or better is required.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Not eligible')).toBeInTheDocument();

    const alternatives = await screen.findByRole('region', { name: 'Other programmes to explore' });
    expect(
      within(alternatives).getByText(/options to explore, not recommendations/),
    ).toBeInTheDocument();
    expect(within(alternatives).getByRole('link', { name: 'BSc Nursing' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/best for you/i);
  });

  it('switches admission year through the URL', async () => {
    const fetchMock = mockApi(routes);
    const user = userEvent.setup();
    const router = renderRoute(path);
    await user.selectOptions(await screen.findByLabelText('Admission year'), '2025/2026');
    expect(router.state.location.search).toBe('?year=2025%2F2026');
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain(
      `/api/programmes/${programmeDetail.id}?year=2025%2F2026`,
    );
  });

  it('reports incorrect information without collecting personal details', async () => {
    const fetchMock = mockApi({ ...routes, 'POST /api/reports': { received: true } });
    const user = userEvent.setup();
    renderRoute(path);
    await user.click(await screen.findByRole('button', { name: 'Report incorrect information' }));
    await user.type(
      screen.getByLabelText('What is wrong or out of date?'),
      'The deadline has changed to 15 September.',
    );
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Thank you');
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      entityType: 'programme',
      entityId: programmeDetail.id,
      message: 'The deadline has changed to 15 September.',
    });
  });

  it('keeps the report text when sending fails', async () => {
    mockApi({
      ...routes,
      'POST /api/reports': () => Response.json({ error: 'x' }, { status: 500 }),
    });
    const user = userEvent.setup();
    renderRoute(path);
    await user.click(await screen.findByRole('button', { name: 'Report incorrect information' }));
    const box = screen.getByLabelText('What is wrong or out of date?');
    await user.type(box, 'The deadline has changed.');
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be sent');
    expect(box).toHaveValue('The deadline has changed.');
  });

  it('shows "page not found" for unknown programmes', async () => {
    mockApi(catalogueRoutes);
    renderRoute('/programmes/00000000-0000-4000-8000-000000000000');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
