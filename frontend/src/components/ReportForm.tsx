import type { ReportCreateInput } from '@xcel/shared';
import { Flag } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { ApiRequestError, apiPost } from '../lib/api';
import { Button } from './ui/Button';

type Target =
  | { entityType: 'programme'; entityId: string }
  | { entityType: 'university' | 'scholarship'; slug: string };

/** "Report incorrect information" (SRS 10.1). Sends only the message: no contact details. */
export function ReportForm({ target }: { target: Target }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const id = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (message.trim().length < 10) {
      setState('error');
      setError('Please describe what is wrong in at least 10 characters.');
      return;
    }
    setState('sending');
    try {
      await apiPost('/reports', { ...target, message: message.trim() } as ReportCreateInput);
      setState('sent');
    } catch (e) {
      setState('error');
      setError(
        e instanceof ApiRequestError && e.status === 429
          ? 'You have sent several reports recently. Please try again later.'
          : 'Your report could not be sent. Please try again.',
      );
    }
  }

  if (state === 'sent') {
    return (
      <p role="status" className="rounded-lg border border-green-300 bg-green-50 p-4">
        Thank you. We will review your report and correct the information if needed.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center gap-2 font-semibold text-blue-700 underline underline-offset-4"
        aria-expanded={open}
        aria-controls={`${id}-form`}
        onClick={() => setOpen((v) => !v)}
      >
        <Flag aria-hidden="true" className="size-4" />
        Report incorrect information
      </button>
      {open && (
        <form id={`${id}-form`} onSubmit={submit} className="mt-4 max-w-xl space-y-3" noValidate>
          <label htmlFor={`${id}-message`} className="block font-semibold">
            What is wrong or out of date?
          </label>
          <p id={`${id}-hint`} className="text-sm">
            Do not include your name, phone number or results. We do not need them.
          </p>
          <textarea
            id={`${id}-message`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={4}
            aria-describedby={`${id}-hint${state === 'error' ? ` ${id}-error` : ''}`}
            aria-invalid={state === 'error'}
            className="w-full rounded-md border border-blue-300 p-3"
          />
          {state === 'error' && (
            <p id={`${id}-error`} role="alert" className="text-red-800">
              {error}
            </p>
          )}
          <Button type="submit" variant="secondary" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Send report'}
          </Button>
        </form>
      )}
    </div>
  );
}
