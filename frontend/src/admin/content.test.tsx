import type {
  AdminGrade,
  AdminMentor,
  AdminReport,
  AdminScholarshipDetail,
  AdminSubject,
} from '@xcel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { page } from '../test/fixtures';
import { mockApi } from '../test/mock-api';
import { renderRoute } from '../test/render';

const signedIn = {
  'GET /api/admin/auth/me': {
    user: { id: 'u1', email: 'admin@example.com', name: 'Ama Admin', role: 'admin' },
  },
};
const sent = (fetchMock: ReturnType<typeof mockApi>, method: string, path: string) =>
  fetchMock.mock.calls
    .filter(([url, init]) => init?.method === method && String(url).startsWith(`/api${path}`))
    .map(([, init]) => JSON.parse(String(init?.body ?? 'null')) as unknown);

const SID = '44444444-4444-4444-8444-444444444444';
const CID = '55555555-5555-4555-8555-555555555555';
const scholarship: AdminScholarshipDetail = {
  id: SID,
  slug: 'merit-award',
  name: 'Merit Award',
  providerName: 'Ghana Education Trust',
  providerUrl: 'https://get.example',
  logoUrl: null,
  universityId: null,
  description: null,
  coverage: null,
  studyLevels: ['undergraduate'],
  fields: ['Engineering'],
  eligibilityCategories: [],
  location: 'Ghana',
  status: 'draft',
  publishedAt: null,
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  cycles: [
    {
      id: CID,
      academicYear: '2026/2027',
      opensOn: '2026-09-01',
      closesOn: '2026-12-01',
      applicationUrl: null,
      requirements: ['Ghanaian citizen'],
      lastVerifiedAt: null,
    },
  ],
};

describe('scholarship admin', () => {
  it('edits details, cycle dates and requirements, sending only what changed', async () => {
    const fetchMock = mockApi({
      ...signedIn,
      [`GET /api/admin/scholarships/${SID}`]: scholarship,
      'GET /api/admin/universities': page([]),
      'GET /api/admin/verification': page([]),
      [`PATCH /api/admin/scholarships/${SID}`]: scholarship,
      [`PATCH /api/admin/scholarship-cycles/${CID}`]: {},
      [`PUT /api/admin/scholarship-cycles/${CID}/requirements`]: { requirements: [] },
    });
    const u = userEvent.setup();
    renderRoute(`/admin/scholarships/${SID}`);

    const fields = await screen.findByLabelText(/^Fields of study/);
    await u.clear(fields);
    await u.type(fields, 'Engineering, Health');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(sent(fetchMock, 'PATCH', `/admin/scholarships/${SID}`)).toEqual([
        { fields: ['Engineering', 'Health'] },
      ]),
    );

    const closes = screen.getByLabelText(/^Closes/);
    await u.clear(closes);
    await u.type(closes, '2026-12-15');
    await u.type(screen.getByLabelText(/^Eligibility requirements/), '\nStudying in Ghana');
    await u.click(screen.getByRole('button', { name: 'Save 2026/2027 cycle' }));
    await waitFor(() =>
      expect(sent(fetchMock, 'PUT', `/admin/scholarship-cycles/${CID}/requirements`)).toEqual([
        {
          requirements: [{ description: 'Ghanaian citizen' }, { description: 'Studying in Ghana' }],
        },
      ]),
    );
    expect(sent(fetchMock, 'PATCH', `/admin/scholarship-cycles/${CID}`)).toEqual([
      { closesOn: '2026-12-15' },
    ]);
  });

  it('confirms before publishing and shows why the server refused', async () => {
    mockApi({
      ...signedIn,
      [`GET /api/admin/scholarships/${SID}`]: scholarship,
      'GET /api/admin/universities': page([]),
      'GET /api/admin/verification': page([]),
      [`POST /api/admin/scholarships/${SID}/status`]: () =>
        Response.json(
          { error: 'Verify the 2026/2027 cycle against a source before publishing' },
          { status: 409 },
        ),
    });
    const u = userEvent.setup();
    renderRoute(`/admin/scholarships/${SID}`);
    await u.click(await screen.findByRole('button', { name: 'Publish' }));
    const dialog = screen.getByRole('dialog');
    await u.click(within(dialog).getByRole('button', { name: 'Publish' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /Verify the 2026\/2027 cycle/,
    );
  });
});

const MID = '66666666-6666-4666-8666-666666666666';
const mentor: AdminMentor = {
  id: MID,
  slug: 'evans-kwasi',
  fullName: 'Evans Kwasi',
  headline: null,
  photoUrl: null,
  bio: null,
  background: null,
  contactEmail: 'evans@example.com',
  status: 'inactive',
  topics: ['general_guidance'],
  fields: [],
  programmeAreas: [],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  requestsSent: 3,
};

describe('mentor admin', () => {
  it('shows the private email to admins and saves topics', async () => {
    const fetchMock = mockApi({
      ...signedIn,
      'GET /api/admin/mentors': [mentor],
      [`GET /api/admin/mentors/${MID}`]: mentor,
      [`PUT /api/admin/mentors/${MID}/expertise`]: mentor,
    });
    const u = userEvent.setup();
    renderRoute('/admin/mentors');
    expect(await screen.findByText('evans@example.com')).toBeInTheDocument();
    await u.click(screen.getByRole('link', { name: 'Evans Kwasi' }));

    await u.click(await screen.findByLabelText('Scholarship guidance'));
    await u.type(screen.getByLabelText(/^Fields/), 'Health, Health');
    await u.click(screen.getByRole('button', { name: 'Save topics and expertise' }));
    await waitFor(() =>
      expect(sent(fetchMock, 'PUT', `/admin/mentors/${MID}/expertise`)).toEqual([
        {
          topics: ['general_guidance', 'scholarship_guidance'],
          fields: ['Health'],
          programmeAreas: [],
        },
      ]),
    );
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
  });
});

describe('subjects and grades', () => {
  const subjects: AdminSubject[] = [
    {
      code: 'ENGLISH',
      name: 'English Language',
      category: 'core',
      aliases: [],
      isActive: true,
      usedByRules: 5,
    },
    {
      code: 'MUSIC',
      name: 'Music',
      category: 'elective',
      aliases: [],
      isActive: true,
      usedByRules: 0,
    },
  ];
  const grades: AdminGrade[] = [
    { code: 'A1', label: 'Excellent', rank: 1, points: 1, isPass: true, usedByRules: 0 },
    { code: 'B2', label: 'Very good', rank: 2, points: 2, isPass: true, usedByRules: 0 },
  ];

  it('only offers to delete unused subjects, and saves a new grade order', async () => {
    const fetchMock = mockApi({
      ...signedIn,
      'GET /api/admin/subjects': subjects,
      'GET /api/admin/grades': grades,
      'PUT /api/admin/grades/order': grades,
    });
    const u = userEvent.setup();
    renderRoute('/admin/subjects-grades');
    expect(await screen.findByRole('button', { name: 'Delete Music' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete English Language' })).toBeNull();
    expect(screen.getByText('Used by 5 rules')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Move B2 up' }));
    await u.click(screen.getByRole('button', { name: 'Save grade order' }));
    await waitFor(() =>
      expect(sent(fetchMock, 'PUT', '/admin/grades/order')).toEqual([{ codes: ['B2', 'A1'] }]),
    );
  });
});

describe('error reports', () => {
  const report: AdminReport = {
    id: '77777777-7777-4777-8777-777777777777',
    entityType: 'scholarship',
    entityId: SID,
    entityLabel: 'Merit Award',
    message: 'The deadline shown is wrong.',
    status: 'open',
    adminNotes: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: '2026-10-05T00:00:00Z',
  };

  it('lists open reports first and records a resolution with notes', async () => {
    const fetchMock = mockApi({
      ...signedIn,
      'GET /api/admin/reports': page([report]),
      [`POST /api/admin/reports/${report.id}/status`]: { ...report, status: 'resolved' },
    });
    const u = userEvent.setup();
    renderRoute('/admin/reports');
    expect(await screen.findByRole('link', { name: 'Merit Award' })).toHaveAttribute(
      'href',
      `/admin/scholarships/${SID}`,
    );
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      '/api/admin/reports?status=open&page=1&pageSize=20',
    );
    await u.click(screen.getByRole('button', { name: /Update status/ }));
    await u.selectOptions(screen.getByLabelText(/^New status/), 'resolved');
    await u.type(screen.getByLabelText(/^Notes/), 'Corrected the closing date.');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(sent(fetchMock, 'POST', `/admin/reports/${report.id}/status`)).toEqual([
        { status: 'resolved', adminNotes: 'Corrected the closing date.' },
      ]),
    );
  });
});

describe('audit log and settings', () => {
  it('shows who changed what, with before and after', async () => {
    mockApi({
      ...signedIn,
      'GET /api/admin/audit-logs': page([
        {
          id: 1,
          occurredAt: '2026-10-08T10:00:00Z',
          action: 'university.update',
          entityType: 'university',
          entityId: 'u-1',
          actor: { id: 'u1', name: 'Ama Admin', email: 'admin@example.com' },
          before: { town: 'Kumasi' },
          after: { town: 'Obuasi' },
        },
      ]),
    });
    renderRoute('/admin/audit-log');
    expect(await screen.findByText('university.update')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByText(/Ama Admin/)).toBeInTheDocument();
    expect(screen.getByText(/"town": "Obuasi"/)).toBeInTheDocument();
  });

  it('saves the stale-record threshold', async () => {
    const fetchMock = mockApi({
      ...signedIn,
      'GET /api/admin/settings': { staleAfterDays: 365 },
      'PATCH /api/admin/settings': { staleAfterDays: 180 },
    });
    const u = userEvent.setup();
    renderRoute('/admin/settings');
    const days = await screen.findByLabelText(/^Flag records as stale/);
    await u.clear(days);
    await u.type(days, '180');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(sent(fetchMock, 'PATCH', '/admin/settings')).toEqual([{ staleAfterDays: 180 }]),
    );
  });
});
