import { afterEach, describe, expect, it, vi } from 'vitest';
import { turnstileVerifier } from './captcha';
import { memoryMailer, resendMailer } from './mailer';

afterEach(() => vi.unstubAllGlobals());

const email = {
  to: 'mentor@example.com',
  subject: 'Hi',
  text: 'Body',
  replyTo: 'kofi@example.com',
};

describe('resendMailer', () => {
  it('posts the email to Resend with the student as reply-to', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await resendMailer('re_key', 'Xcel <mentors@xcel.example>').send(email);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer re_key' });
    expect(JSON.parse(String(init.body))).toEqual({
      from: 'Xcel <mentors@xcel.example>',
      to: ['mentor@example.com'],
      subject: 'Hi',
      text: 'Body',
      reply_to: 'kofi@example.com',
    });
  });

  it('omits reply-to when the student gave no email', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await resendMailer('k', 'f').send({ ...email, replyTo: null });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty('reply_to');
  });

  it('fails without including the email in the error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad', { status: 422 })),
    );
    const error = await resendMailer('k', 'f')
      .send(email)
      .catch((e: Error) => e);
    expect(String(error)).toBe('Error: Resend rejected the email (HTTP 422)');
  });
});

describe('memoryMailer', () => {
  it('keeps emails in memory without printing them', async () => {
    const log = vi.spyOn(console, 'log');
    const mailer = memoryMailer();
    await mailer.send(email);
    expect(mailer.outbox).toEqual([email]);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('turnstileVerifier', () => {
  it('accepts a token Cloudflare confirms', async () => {
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await turnstileVerifier('secret')('token', '203.0.113.1')).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).toBe('secret=secret&response=token&remoteip=203.0.113.1');
  });

  it('rejects a token Cloudflare refuses, or when Cloudflare cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ success: false })),
    );
    expect(await turnstileVerifier('s')('t', 'unknown')).toBe(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await turnstileVerifier('s')('t', 'unknown')).toBe(false);
  });
});
