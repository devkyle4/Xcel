import { describe, expect, it } from 'vitest';
import {
  buildMentorEmail,
  defaultSessionMessage,
  formatGhanaPhone,
  normaliseGhanaPhone,
  sessionRequestSchema,
} from './mentors';

describe('Ghana phone numbers', () => {
  it.each([
    ['024 412 3456', '+233244123456'],
    ['0244123456', '+233244123456'],
    ['055-123-4567', '+233551234567'],
    ['+233 24 412 3456', '+233244123456'],
    ['+233501234567', '+233501234567'],
  ])('normalises %s', (input, expected) => {
    expect(normaliseGhanaPhone(input)).toBe(expected);
  });

  it.each(['0302123456', '024412345', '02441234567', '+44 7700 900123', '233244123456', 'abc'])(
    'rejects %s',
    (input) => {
      expect(normaliseGhanaPhone(input)).toBeNull();
    },
  );

  it('formats for display', () => {
    expect(formatGhanaPhone('+233244123456')).toBe('+233 24 412 3456');
  });
});

describe('defaultSessionMessage', () => {
  it('fills in the mentor, student and topic', () => {
    expect(defaultSessionMessage('Ama Mensah', 'Kofi Boateng', 'choosing_programme')).toBe(
      [
        'Hello Ama Mensah,',
        '',
        'My name is Kofi Boateng. I recently completed SHS and I would like to book a mentoring session with you on choosing a university programme.',
        '',
        'Please contact me on the phone number below to arrange a convenient date and time.',
        '',
        'Thank you.',
      ].join('\n'),
    );
  });

  it('keeps acronyms and shows placeholders until filled in', () => {
    const message = defaultSessionMessage('Ama', '', 'wassce_requirements');
    expect(message).toContain('My name is [your name].');
    expect(message).toContain('on understanding WASSCE results and programme requirements.');
    expect(defaultSessionMessage('Ama', 'Kofi', '')).toContain('with you on [topic].');
  });
});

describe('sessionRequestSchema', () => {
  const valid = {
    fullName: 'Kofi Boateng',
    phone: '024 412 3456',
    email: '',
    topic: 'scholarship_guidance',
    message: 'Hello',
    disclaimerAccepted: true,
    captchaToken: 'token',
  };

  it('normalises the phone and treats a blank email as not provided', () => {
    expect(sessionRequestSchema.parse(valid)).toMatchObject({
      phone: '+233244123456',
      email: null,
    });
  });

  it.each([
    ['a short name', { fullName: 'K' }],
    ['a landline', { phone: '030 212 3456' }],
    ['a bad email', { email: 'kofi@' }],
    ['an unknown topic', { topic: 'dating' }],
    ['an empty message', { message: '   ' }],
    ['a message over 1,000 characters', { message: 'x'.repeat(1001) }],
    ['no disclaimer', { disclaimerAccepted: false }],
    ['no CAPTCHA token', { captchaToken: '' }],
    ['extra fields', { address: 'Kumasi' }],
  ])('rejects %s', (_, change) => {
    expect(sessionRequestSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

describe('buildMentorEmail', () => {
  const request = sessionRequestSchema.parse({
    fullName: 'Kofi Boateng',
    phone: '0244123456',
    email: 'kofi@example.com',
    topic: 'scholarship_guidance',
    message: 'Hello Ama,\n\nCan we talk about scholarships?',
    disclaimerAccepted: true,
    captchaToken: 't',
  });

  it('follows the agreed format, with the student email as reply-to', () => {
    expect(buildMentorEmail(request)).toEqual({
      subject: 'Mentoring request from Kofi Boateng – Scholarship guidance',
      text: [
        'Hello Ama,',
        '',
        'Can we talk about scholarships?',
        '',
        '──────────────',
        'Name:   Kofi Boateng',
        'Phone:  +233 24 412 3456',
        'Email:  kofi@example.com',
        'Topic:  Scholarship guidance',
        'Sent via Xcel',
      ].join('\n'),
      replyTo: 'kofi@example.com',
    });
  });

  it('says "Not provided" without an email', () => {
    const email = buildMentorEmail({ ...request, email: null });
    expect(email.text).toContain('Email:  Not provided');
    expect(email.replyTo).toBeNull();
  });
});
