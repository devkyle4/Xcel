import type { AdminUniversityDetail } from '@xcel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { page } from '../test/fixtures';
import { mockApi } from '../test/mock-api';
import { renderRoute } from '../test/render';

const user = { id: 'u1', email: 'admin@example.com', name: 'Ama Admin', role: 'admin' };
const signedIn = { 'GET /api/admin/auth/me': { user } };
const unauthorized = () => Response.json({ error: 'Authentication required' }, { status: 401 });

const dashboard = {
  universities: { published: 2 },
  programmes: { published: 10, draft: 1 },
  admissionCycles: { published: 10 },
  scholarships: { published: 4, overdue: 1 },
  mentors: { active: 2, inactive: 0, archived: 0 },
  openReports: 3,
  staleRecords: 0,
};

const university: AdminUniversityDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'test-university',
  name: 'Test University',
  shortName: 'TU',
  institutionType: 'public_university',
  region: 'ashanti',
  town: 'Kumasi',
  description: null,
  websiteUrl: null,
  admissionsUrl: null,
  logoUrl: null,
  status: 'needs_verification',
  publishedAt: null,
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  facultySchools: [],
  verifications: [],
};
const UNI_PATH = `/api/admin/universities/${university.id}`;

describe('admin sign-in', () => {
  it('sends signed-out visitors to sign in, then back where they were going', async () => {
    let signedInNow = false;
    const fetchMock = mockApi({
      'GET /api/admin/auth/me': () => (signedInNow ? { user } : unauthorized()),
      'POST /api/admin/auth/login': () => {
        signedInNow = true;
        return { user };
      },
      'GET /api/admin/dashboard': dashboard,
      'GET /api/admin/verification/stale': { staleAfterDays: 365, items: [] },
      'GET /api/admin/universities': page([university]),
    });
    const u = userEvent.setup();
    const router = renderRoute('/admin/universities');

    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?next=%2Fadmin%2Funiversities');

    await u.type(screen.getByLabelText('Email address'), 'admin@example.com');
    await u.type(screen.getByLabelText('Password'), 'correct horse battery');
    await u.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Universities' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/universities');
    const login = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/login'));
    expect(JSON.parse(String(login?.[1]?.body))).toEqual({
      email: 'admin@example.com',
      password: 'correct horse battery',
    });
  });

  it('shows the server error and clears the password on a failed sign-in', async () => {
    mockApi({
      'GET /api/admin/auth/me': unauthorized,
      'POST /api/admin/auth/login': () =>
        Response.json({ error: 'Invalid email or password' }, { status: 401 }),
    });
    const u = userEvent.setup();
    renderRoute('/admin/login');
    await u.type(await screen.findByLabelText('Email address'), 'admin@example.com');
    await u.type(screen.getByLabelText('Password'), 'wrong');
    await u.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('never follows a ?next= link off the admin area', async () => {
    mockApi(signedIn);
    const router = renderRoute('/admin/login?next=//evil.example/admin');
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'));
  });

  it('returns to sign-in when the session ends', async () => {
    mockApi({
      'GET /api/admin/auth/me': { user },
      'GET /api/admin/dashboard': unauthorized,
      'GET /api/admin/verification/stale': unauthorized,
    });
    const router = renderRoute('/admin');
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/login'));
  });
});

describe('admin dashboard', () => {
  it('shows counts and what needs attention', async () => {
    mockApi({
      ...signedIn,
      'GET /api/admin/dashboard': dashboard,
      'GET /api/admin/verification/stale': { staleAfterDays: 365, items: [] },
    });
    renderRoute('/admin');
    expect(await screen.findByText(/3 open error reports/)).toBeInTheDocument();
    expect(
      screen.getByText(/1 published scholarship has a closing date in the past/),
    ).toBeInTheDocument();
    expect(screen.getByText('Ama Admin')).toBeInTheDocument();
    // The admin area is kept out of search engines.
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
  });
});

describe('university editing', () => {
  it('validates with the shared schema and saves only the changed fields', async () => {
    const fetchMock = mockApi({
      ...signedIn,
      [`GET ${UNI_PATH}`]: university,
      [`PATCH ${UNI_PATH}`]: { ...university, town: 'Obuasi' },
    });
    const u = userEvent.setup();
    renderRoute(`/admin/universities/${university.id}`);

    const town = await screen.findByLabelText(/^Town/);
    const website = screen.getByLabelText(/^Website/);
    await u.type(website, 'not a link');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findAllByText('Enter a full http:// or https:// URL')).not.toHaveLength(0);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);

    await u.clear(website);
    await u.clear(town);
    await u.type(town, 'Obuasi');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true),
    );
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ town: 'Obuasi' });
  });

  it('asks before leaving with unsaved changes', async () => {
    mockApi({
      ...signedIn,
      [`GET ${UNI_PATH}`]: university,
      'GET /api/admin/sources': page([]),
    });
    const u = userEvent.setup();
    const router = renderRoute(`/admin/universities/${university.id}`);
    await u.type(await screen.findByLabelText(/^Town/), ' Central');
    await u.click(screen.getByRole('link', { name: 'Sources' }));

    const dialog = await screen.findByRole('dialog', { name: 'Leave without saving?' });
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(router.state.location.pathname).toBe(`/admin/universities/${university.id}`);
    expect(screen.getByLabelText(/^Town/)).toHaveValue('Kumasi Central');
  });

  it('offers only the allowed workflow steps and shows why the server refused', async () => {
    const fetchMock = mockApi({
      ...signedIn,
      [`GET ${UNI_PATH}`]: university,
      [`POST ${UNI_PATH}/status`]: () =>
        Response.json(
          { error: 'Add a verification record with a source before marking this verified' },
          { status: 409 },
        ),
    });
    const u = userEvent.setup();
    renderRoute(`/admin/universities/${university.id}`);
    await screen.findByRole('button', { name: 'Mark as verified' });
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Mark as verified' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Add a verification record/);
    const post = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/status'));
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ status: 'verified' });
  });

  it('confirms before archiving', async () => {
    const fetchMock = mockApi({
      ...signedIn,
      [`GET ${UNI_PATH}`]: university,
      [`POST ${UNI_PATH}/status`]: { ...university, status: 'archived' },
    });
    const u = userEvent.setup();
    renderRoute(`/admin/universities/${university.id}`);
    await u.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = screen.getByRole('dialog', { name: 'Archive Test University?' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/status'))).toBe(false);
    await u.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/status'))).toBe(true);
  });
});
