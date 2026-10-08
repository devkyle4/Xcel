import {
  defaultSessionMessage,
  formatGhanaPhone,
  MENTORING_TOPICS,
  type MentoringTopicCode,
  MESSAGE_MAX_LENGTH,
  sessionRequestSchema,
  type SessionRequestResponse,
} from '@xcel/shared';
import { type FormEvent, useId, useState } from 'react';
import { ApiRequestError, apiPost } from '../../lib/api';
import { MENTORING_DISCLAIMER } from '../Disclaimer';
import { Turnstile } from '../Turnstile';
import { Button } from '../ui/Button';

type Field =
  'fullName' | 'phone' | 'email' | 'topic' | 'message' | 'disclaimerAccepted' | 'captchaToken';

const inputClasses = 'w-full rounded-md border border-blue-300 bg-white p-2.5';

/**
 * Session request form (CLAUDE.md "Mentor session requests"). Nothing is
 * saved: the request is emailed to the mentor by the server and discarded.
 */
export function SessionRequestForm({
  mentorSlug,
  mentorName,
}: {
  mentorSlug: string;
  mentorName: string;
}) {
  const id = useId();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<MentoringTopicCode | ''>('');
  // The default message follows the name and topic until the student edits it.
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const message = customMessage ?? defaultSessionMessage(mentorName, fullName, topic);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<SessionRequestResponse | null>(null);

  if (sent) {
    return (
      <div role="status" className="rounded-lg border border-green-300 bg-green-50 p-5">
        <p className="text-lg font-semibold">
          Your message has been sent to {sent.mentorName}. They’ll contact you on{' '}
          {formatGhanaPhone(sent.phone)}.
        </p>
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const input = {
      fullName,
      phone,
      email,
      topic,
      message,
      disclaimerAccepted,
      captchaToken: captchaToken ?? '',
    };
    const parsed = sessionRequestSchema.safeParse(input);
    if (!parsed.success) {
      const found: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        found[field] ??= issue.message;
      }
      setErrors(found);
      return;
    }
    setErrors({});
    setSending(true);
    try {
      setSent(await apiPost<SessionRequestResponse>(`/mentors/${mentorSlug}/request`, input));
    } catch (e) {
      // Keep everything the student entered; security-check tokens work once, so get a new one.
      setCaptchaToken(null);
      setCaptchaResetKey((k) => k + 1);
      setFailure(
        e instanceof ApiRequestError && e.body?.error
          ? e.body.error
          : 'Your message could not be sent. Check your connection and try again.',
      );
    } finally {
      setSending(false);
    }
  }

  const describedBy = (field: Field, hint?: string) =>
    [hint, errors[field] && `${id}-${field}-error`].filter(Boolean).join(' ') || undefined;
  const fieldError = (field: Field) =>
    errors[field] && (
      <p id={`${id}-${field}-error`} className="mt-1 text-sm text-red-800">
        {errors[field]}
      </p>
    );
  const errorList = Object.values(errors);

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-5">
      <p>
        Your request is emailed to {mentorName}, who will contact you to arrange the session. We do
        not keep a copy.
      </p>

      {errorList.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="font-semibold text-red-800">Please fix the following:</p>
          <ul className="mt-2 list-disc pl-5 text-red-800">
            {errorList.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label htmlFor={`${id}-name`} className="mb-1 block font-semibold">
          Full name
        </label>
        <input
          id={`${id}-name`}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={100}
          autoComplete="name"
          className={inputClasses}
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={describedBy('fullName')}
        />
        {fieldError('fullName')}
      </div>

      <div>
        <label htmlFor={`${id}-phone`} className="mb-1 block font-semibold">
          Phone number
        </label>
        <p id={`${id}-phone-hint`} className="mb-1 text-sm">
          A Ghana mobile number, e.g. 024 412 3456. The mentor will call you on it.
        </p>
        <input
          id={`${id}-phone`}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          inputMode="tel"
          className={inputClasses}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={describedBy('phone', `${id}-phone-hint`)}
        />
        {fieldError('phone')}
      </div>

      <div>
        <label htmlFor={`${id}-email`} className="mb-1 block font-semibold">
          Email address (optional)
        </label>
        <p id={`${id}-email-hint`} className="mb-1 text-sm">
          If you add one, the mentor can reply to you by email.
        </p>
        <input
          id={`${id}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={inputClasses}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy('email', `${id}-email-hint`)}
        />
        {fieldError('email')}
      </div>

      <div>
        <label htmlFor={`${id}-topic`} className="mb-1 block font-semibold">
          Topic
        </label>
        <select
          id={`${id}-topic`}
          value={topic}
          onChange={(e) => setTopic(e.target.value as MentoringTopicCode | '')}
          className={inputClasses}
          aria-invalid={errors.topic ? true : undefined}
          aria-describedby={describedBy('topic')}
        >
          <option value="">Choose a topic</option>
          {MENTORING_TOPICS.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
        {fieldError('topic')}
      </div>

      <div>
        <label htmlFor={`${id}-message`} className="mb-1 block font-semibold">
          Message
        </label>
        <p id={`${id}-message-hint`} className="mb-1 text-sm">
          You can send this message as it is, edit it, or write your own. {message.length}/
          {MESSAGE_MAX_LENGTH} characters.
        </p>
        <textarea
          id={`${id}-message`}
          value={message}
          onChange={(e) => setCustomMessage(e.target.value)}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={9}
          className={inputClasses}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy('message', `${id}-message-hint`)}
        />
        {customMessage !== null && (
          <button
            type="button"
            className="mt-1 text-sm font-semibold text-blue-700 underline underline-offset-4"
            onClick={() => setCustomMessage(null)}
          >
            Use the suggested message
          </button>
        )}
        {fieldError('message')}
      </div>

      <div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={disclaimerAccepted}
            onChange={(e) => setDisclaimerAccepted(e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-green-700"
            aria-invalid={errors.disclaimerAccepted ? true : undefined}
            aria-describedby={describedBy('disclaimerAccepted')}
          />
          <span>I understand that mentoring is guidance only. {MENTORING_DISCLAIMER}</span>
        </label>
        {fieldError('disclaimerAccepted')}
      </div>

      <div>
        <Turnstile onToken={setCaptchaToken} resetKey={captchaResetKey} />
        {fieldError('captchaToken')}
      </div>

      {failure && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          {failure}
        </p>
      )}

      <Button type="submit" disabled={sending}>
        {sending ? 'Sending…' : 'Send request'}
      </Button>
    </form>
  );
}
