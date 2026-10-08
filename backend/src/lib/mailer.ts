import { getEnv } from '../env';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  replyTo: string | null;
}

export interface Mailer {
  send(email: OutgoingEmail): Promise<void>;
}

/** Sends through Resend's HTTP API (no SDK needed in a serverless function). */
export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(email) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          ...(email.replyTo && { reply_to: email.replyTo }),
        }),
      });
      // The error deliberately excludes the email itself: it contains student details.
      if (!res.ok) throw new Error(`Resend rejected the email (HTTP ${res.status})`);
    },
  };
}

/**
 * Development and tests: keeps emails in memory and never prints them, since
 * they contain student details that must not reach logs.
 */
export function memoryMailer(): Mailer & { outbox: OutgoingEmail[] } {
  const outbox: OutgoingEmail[] = [];
  return {
    outbox,
    async send(email) {
      outbox.push(email);
    },
  };
}

let defaultMailer: Mailer | undefined;

export function getMailer(): Mailer {
  if (!defaultMailer) {
    const env = getEnv();
    defaultMailer =
      env.RESEND_API_KEY && env.MAIL_FROM
        ? resendMailer(env.RESEND_API_KEY, env.MAIL_FROM)
        : memoryMailer();
  }
  return defaultMailer;
}
