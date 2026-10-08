import type { AdminCycle } from '@xcel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogueRoutes } from '../test/fixtures';
import { mockApi } from '../test/mock-api';
import { renderRoute } from '../test/render';

const user = { id: 'u1', email: 'admin@example.com', name: 'Ama Admin', role: 'admin' };
const ID = '22222222-2222-4222-8222-222222222222';

const cycle = (overrides: Partial<AdminCycle> = {}): AdminCycle => ({
  id: ID,
  programmeId: 'p1',
  academicYear: '2026/2027',
  version: 1,
  supersedesCycleId: null,
  status: 'draft',
  applicationOpensOn: null,
  applicationDeadline: null,
  applicationUrl: null,
  notes: null,
  verifiedAt: null,
  publishedAt: null,
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  editable: true,
  programme: { id: 'p1', name: 'BSc Physics', universityName: 'Test University' },
  requirements: {
    kind: 'group',
    id: 'root',
    operator: 'all',
    children: [
      {
        kind: 'rule',
        id: 'eng',
        ruleType: 'subject_grade',
        params: { subjectCodes: ['ENGLISH'], minGrade: 'C6' },
      },
    ],
  },
  issues: [],
  verifications: [],
  versions: [{ id: ID, version: 1, status: 'draft', publishedAt: null }],
  ...overrides,
});

const routes = (c: AdminCycle) => ({
  ...catalogueRoutes,
  'GET /api/admin/auth/me': { user },
  [`GET /api/admin/cycles/${ID}`]: c,
});

describe('admission cycle rule builder', () => {
  it('describes rules in plain language and saves the edited tree', async () => {
    const fetchMock = mockApi({
      ...routes(cycle()),
      [`PUT /api/admin/cycles/${ID}/requirements`]: cycle(),
    });
    const u = userEvent.setup();
    renderRoute(`/admin/cycles/${ID}`);

    const builder = within(await screen.findByRole('region', { name: 'Requirements' }));
    expect(builder.getByText('English Language: C6 or better')).toBeInTheDocument();
    await u.click(builder.getByRole('button', { name: /Edit requirement/ }));
    await u.selectOptions(builder.getByLabelText('Minimum grade'), 'B3');
    expect(builder.getByText('English Language: B3 or better')).toBeInTheDocument();

    // An incomplete rule is flagged with a plain message, but can still be saved.
    const root = builder.getByRole('region', { name: 'group “All of the following”' });
    await u.selectOptions(
      within(root)
        .getAllByLabelText(/^Add to group/)
        .at(-1)!,
      'manual_review',
    );
    await u.click(within(root).getAllByRole('button', { name: 'Add' }).at(-1)!);
    expect(builder.getByText('Describe what must be confirmed.')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Save requirements' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true),
    );
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    const body = JSON.parse(String(put?.[1]?.body)) as {
      requirements: { operator: string; children: { ruleType: string; params: unknown }[] };
    };
    expect(body.requirements.operator).toBe('all');
    expect(body.requirements.children.map((c) => [c.ruleType, c.params])).toEqual([
      ['subject_grade', { subjectCodes: ['ENGLISH'], minGrade: 'B3' }],
      ['manual_review', { description: '' }],
    ]);
  });

  it('flags a group that can never be satisfied', async () => {
    mockApi(routes(cycle()));
    const u = userEvent.setup();
    renderRoute(`/admin/cycles/${ID}`);
    await u.selectOptions(await screen.findByLabelText('Students must meet'), 'at_least');
    await u.clear(screen.getByLabelText('N'));
    await u.type(screen.getByLabelText('N'), '3');
    expect(screen.getByText('"Any N of" needs N between 1 and 1')).toBeInTheDocument();
  });

  it('tests sample results in the browser without sending them anywhere', async () => {
    const fetchMock = mockApi(routes(cycle()));
    const u = userEvent.setup();
    renderRoute(`/admin/cycles/${ID}`);
    await u.selectOptions(await screen.findByLabelText('Grade in English Language'), 'D7');
    const panel = screen.getByRole('region', { name: 'Try with sample results' });
    expect(within(panel).getByText('Not eligible')).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Grade in English Language'), 'B2');
    expect(within(panel).getByText('Eligible')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method && init.method !== 'GET')).toBe(
      false,
    );
  });

  it('shows a published version read-only and offers a new version', async () => {
    const fetchMock = mockApi({
      ...routes(
        cycle({ status: 'published', publishedAt: '2026-10-02T00:00:00Z', editable: false }),
      ),
      [`POST /api/admin/cycles/${ID}/new-version`]: () =>
        Response.json(cycle({ id: '33333333-3333-4333-8333-333333333333' }), { status: 201 }),
      'GET /api/admin/cycles/33333333-3333-4333-8333-333333333333': cycle({
        id: '33333333-3333-4333-8333-333333333333',
        version: 2,
        supersedesCycleId: ID,
      }),
    });
    const u = userEvent.setup();
    const router = renderRoute(`/admin/cycles/${ID}`);
    expect(await screen.findByText(/This version has been published/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save requirements' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit requirement/ })).not.toBeInTheDocument();
    // A published cycle can never go back to draft or verified.
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /draft/i })).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Create new version' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/admin/cycles/33333333-3333-4333-8333-333333333333',
      ),
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/new-version'))).toBe(true);
    expect(
      await screen.findByRole('heading', { name: 'Changes from version 1' }),
    ).toBeInTheDocument();
    expect(screen.getByText('The requirements are the same as version 1.')).toBeInTheDocument();
  });
});
