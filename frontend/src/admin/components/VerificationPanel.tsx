import {
  type AdminSource,
  type AdminVerificationRecord,
  sourceCreateSchema,
  type VerifiableEntityType,
  verificationCreateSchema,
  type VerificationStatus,
} from '@xcel/shared';
import { ExternalLink, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatDate } from '../../lib/format';
import { requestErrors, useAdminList, useAdminMutation } from '../api';
import { orNull, validate } from '../forms';
import { VERIFICATION_STATUS_LABELS } from '../labels';
import { Panel } from './AdminPage';
import { ErrorSummary, inputClasses, SelectField, TextAreaField, TextField } from './fields';

/** Verification history for a record, newest first, with a button to add a check. */
export function VerificationPanel({
  entityType,
  entityId,
  records,
}: {
  entityType: VerifiableEntityType;
  entityId: string;
  records: AdminVerificationRecord[];
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Panel
      title="Verification"
      actions={
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" className="size-5" /> Record a check
        </Button>
      }
    >
      {records.length === 0 ? (
        <p>Not checked against a source yet. A record must be verified before it is published.</p>
      ) : (
        <VerificationList records={records} />
      )}
      {adding && (
        <Modal title="Record a verification check" onClose={() => setAdding(false)}>
          <VerificationForm
            entityType={entityType}
            entityId={entityId}
            onDone={() => setAdding(false)}
          />
        </Modal>
      )}
    </Panel>
  );
}

export function VerificationList({ records }: { records: AdminVerificationRecord[] }) {
  return (
    <ul className="divide-y divide-blue-100">
      {records.map((r) => (
        <li key={r.id} className="space-y-0.5 py-3">
          <p>
            <span className="font-semibold">{VERIFICATION_STATUS_LABELS[r.status]}</span> on{' '}
            {formatDate(r.verifiedAt)}
            {r.verifiedBy && ` by ${r.verifiedBy.name}`}
          </p>
          {r.source && (
            <p className="text-sm">
              Source:{' '}
              {r.source.url ? (
                <a href={r.source.url} target="_blank" rel="noopener noreferrer">
                  {r.source.title}
                  <ExternalLink aria-hidden="true" className="ml-1 inline size-3.5" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                r.source.title
              )}
              {r.source.academicYear && ` (${r.source.academicYear})`}
            </p>
          )}
          {r.notes && <p className="text-sm whitespace-pre-line">{r.notes}</p>}
        </li>
      ))}
    </ul>
  );
}

export function VerificationForm({
  entityType,
  entityId,
  onDone,
}: {
  entityType: VerifiableEntityType;
  entityId: string;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<VerificationStatus>('verified');
  const [source, setSource] = useState<AdminSource | null>(null);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useAdminMutation('POST', '/admin/verification');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(verificationCreateSchema, {
      entityType,
      entityId,
      status,
      sourceId: source?.id ?? null,
      notes: orNull(notes),
    });
    setErrors(result.errors ?? {});
    if (!result.data) return;
    create.mutate(result.data, {
      onSuccess: onDone,
      onError: (error) => setErrors(requestErrors(error)),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <ErrorSummary errors={errors} />
      <SelectField
        label="Result"
        required
        value={status}
        onChange={(v) => setStatus(v as VerificationStatus)}
        options={Object.entries(VERIFICATION_STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <SourcePicker
        selected={source}
        onSelect={setSource}
        error={errors.sourceId}
        required={status === 'verified'}
      />
      <TextAreaField
        label="Notes"
        hint="What you checked, and anything that differs from the source."
        value={notes}
        onChange={setNotes}
        rows={3}
        maxLength={2000}
      />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Save check'}
        </Button>
      </div>
    </form>
  );
}

/** Search existing sources, or add a new one, and pick it. */
function SourcePicker({
  selected,
  onSelect,
  error,
  required,
}: {
  selected: AdminSource | null;
  onSelect: (source: AdminSource | null) => void;
  error?: string;
  required: boolean;
}) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const sources = useAdminList<AdminSource>('/admin/sources', {
    q: q.trim() || undefined,
    pageSize: 8,
  });

  if (selected) {
    return (
      <div>
        <p className="mb-1 font-semibold">Source</p>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-300 bg-blue-50 p-3">
          <span>
            {selected.title}
            {selected.academicYear && ` (${selected.academicYear})`}
          </span>
          <Button variant="secondary" onClick={() => onSelect(null)}>
            Change source
          </Button>
        </div>
      </div>
    );
  }

  if (adding) {
    return (
      <NewSourceForm
        onCreated={(s) => {
          setAdding(false);
          onSelect(s);
        }}
        onCancel={() => setAdding(false)}
      />
    );
  }

  return (
    <fieldset className="space-y-2" aria-describedby={error ? 'source-error' : undefined}>
      <legend className="font-semibold">
        Source{!required && <span className="font-normal"> (optional)</span>}
      </legend>
      <label htmlFor="source-search" className="block text-sm">
        Search sources by title, publisher or link
      </label>
      <input
        id="source-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className={inputClasses}
      />
      {sources.data && sources.data.items.length > 0 ? (
        <ul className="max-h-52 divide-y divide-blue-100 overflow-y-auto rounded-md border border-blue-100">
          {sources.data.items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                className="w-full px-3 py-2 text-left hover:bg-blue-50"
              >
                <span className="font-semibold">{s.title}</span>
                <span className="block text-sm">
                  {[s.publisher, s.academicYear].filter(Boolean).join(' · ') || s.url}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        sources.data && <p className="text-sm">No sources match.</p>
      )}
      {error && (
        <p id="source-error" className="text-sm font-semibold text-red-800">
          {error}
        </p>
      )}
      <Button variant="secondary" onClick={() => setAdding(true)}>
        <Plus aria-hidden="true" className="size-5" /> Add a new source
      </Button>
    </fieldset>
  );
}

function NewSourceForm({
  onCreated,
  onCancel,
}: {
  onCreated: (source: AdminSource) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState({ title: '', url: '', publisher: '', academicYear: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useAdminMutation<unknown, AdminSource>('POST', '/admin/sources');
  const set = (key: keyof typeof values) => (v: string) => setValues({ ...values, [key]: v });

  const save = () => {
    const result = validate(sourceCreateSchema, {
      title: values.title.trim(),
      url: orNull(values.url),
      publisher: orNull(values.publisher),
      academicYear: orNull(values.academicYear),
    });
    setErrors(result.errors ?? {});
    if (!result.data) return;
    create.mutate(result.data, {
      onSuccess: onCreated,
      onError: (error) => setErrors(requestErrors(error)),
    });
  };

  // Not a nested <form>: this sits inside the verification form.
  return (
    <fieldset className="space-y-3 rounded-md border border-blue-300 p-3">
      <legend className="px-1 font-semibold">New source</legend>
      {errors[''] && <p className="text-sm font-semibold text-red-800">{errors['']}</p>}
      <TextField
        label="Title"
        required
        value={values.title}
        onChange={set('title')}
        error={errors.title}
      />
      <TextField
        label="Link"
        type="url"
        hint="The official page or document, starting https://"
        value={values.url}
        onChange={set('url')}
        error={errors.url}
      />
      <TextField
        label="Publisher"
        value={values.publisher}
        onChange={set('publisher')}
        error={errors.publisher}
      />
      <TextField
        label="Academic year"
        hint="e.g. 2026/2027"
        value={values.academicYear}
        onChange={set('academicYear')}
        error={errors.academicYear}
      />
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={save} disabled={create.isPending}>
          Add source
        </Button>
      </div>
    </fieldset>
  );
}
