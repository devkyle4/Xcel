import type { MentorSummary } from '@xcel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { page } from '../test/fixtures';
import { mockApi } from '../test/mock-api';
import { renderRoute } from '../test/render';

// The real widget loads a Cloudflare script; the test stand-in hands over a token.
vi.mock('../components/Turnstile', () => ({
  Turnstile: ({ onToken }: { onToken: (token: string | null) => void }) => {
    useEffect(() => onToken('test-token'), [onToken]);
    return null;
  },
}));

const mentors: MentorSummary[] = [
  {
    slug: 'evans-kwasi',
    fullName: 'Evans Kwasi',
    headline: null,
    photoUrl: null,
    topics: ['choosing_programme'],
    fields: [],
  },
  {
    slug: 'aaron-alan-cobbinah',
    fullName: 'Aaron Alan Cobbinah',
    headline: null,
    photoUrl: null,
    topics: ['scholarship_guidance'],
    fields: [],
  },
];

describe('MentorsPage', () => {
  it('lists mentors without exposing their email addresses', async () => {
    mockApi({ 'GET /api/mentors': page(mentors, 2) });
    renderRoute('/mentors');
    expect(await screen.findByRole('link', { name: 'Evans Kwasi' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aaron Alan Cobbinah' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email Aaron' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/@/);
  });

  it('opens a message box and sends the request through the server', async () => {
    const fetchMock = mockApi({
      'GET /api/mentors': page(mentors, 2),
      'POST /api/mentors/evans-kwasi/request': {
        sent: true,
        mentorName: 'Evans Kwasi',
        phone: '+233244123456',
      },
    });
    const user = userEvent.setup();
    renderRoute('/mentors');
    await user.click(await screen.findByRole('button', { name: 'Email Evans' }));

    const dialog = screen.getByRole('dialog', { name: 'Email Evans Kwasi' });
    const box = within(dialog);
    await user.type(box.getByLabelText('Full name'), 'Ama Mensah');
    await user.type(box.getByLabelText('Phone number'), '024 412 3456');
    await user.selectOptions(box.getByLabelText('Topic'), 'choosing_programme');
    expect((box.getByLabelText('Message') as HTMLTextAreaElement).value).toContain(
      'My name is Ama Mensah',
    );
    await user.click(box.getByRole('checkbox'));
    await user.click(box.getByRole('button', { name: /send/i }));

    expect(await box.findByText(/Your message has been sent to Evans Kwasi/)).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).includes('/request'))!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      fullName: 'Ama Mensah',
      phone: '024 412 3456',
      topic: 'choosing_programme',
      captchaToken: 'test-token',
    });

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the form contents when sending fails', async () => {
    mockApi({
      'GET /api/mentors': page(mentors, 2),
      'POST /api/mentors/evans-kwasi/request': Response.json(
        { error: 'Your message could not be sent. Please try again.' },
        { status: 502 },
      ),
    });
    const user = userEvent.setup();
    renderRoute('/mentors');
    await user.click(await screen.findByRole('button', { name: 'Email Evans' }));
    const box = within(screen.getByRole('dialog'));
    await user.type(box.getByLabelText('Full name'), 'Ama Mensah');
    await user.type(box.getByLabelText('Phone number'), '0244123456');
    await user.selectOptions(box.getByLabelText('Topic'), 'choosing_programme');
    await user.click(box.getByRole('checkbox'));
    await user.click(box.getByRole('button', { name: /send/i }));

    expect(await box.findByRole('alert')).toHaveTextContent('could not be sent');
    expect(box.getByLabelText('Full name')).toHaveValue('Ama Mensah');
  });
});
