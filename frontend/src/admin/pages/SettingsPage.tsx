import { type PlatformSettings, settingsUpdateSchema } from '@xcel/shared';
import { type FormEvent, useState } from 'react';
import { LoadError, Loading } from '../../components/LoadState';
import { Button } from '../../components/ui/Button';
import { requestErrors, useAdminGet, useAdminMutation } from '../api';
import { AdminPage, Panel } from '../components/AdminPage';
import { ErrorSummary, TextField } from '../components/fields';
import { validate } from '../forms';

export function SettingsPage() {
  const settings = useAdminGet<PlatformSettings>('/admin/settings');
  return (
    <AdminPage title="Settings">
      {settings.isPending ? (
        <Loading />
      ) : settings.error ? (
        <LoadError onRetry={() => void settings.refetch()} />
      ) : (
        <StaleForm key={settings.data.staleAfterDays} saved={settings.data} />
      )}
    </AdminPage>
  );
}

function StaleForm({ saved }: { saved: PlatformSettings }) {
  const [days, setDays] = useState(String(saved.staleAfterDays));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation('PATCH', '/admin/settings');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(settingsUpdateSchema, { staleAfterDays: Number(days) });
    setErrors(
      result.errors ? { staleAfterDays: 'Enter a whole number of days from 1 to 3650.' } : {},
    );
    if (result.data) save.mutate(result.data, { onError: (e) => setErrors(requestErrors(e)) });
  };

  return (
    <Panel title="Re-verification">
      <form onSubmit={submit} noValidate className="space-y-4">
        <ErrorSummary errors={errors} />
        <div className="max-w-xs">
          <TextField
            label="Flag records as stale after (days)"
            required
            type="number"
            inputMode="numeric"
            hint="Verified or published records not checked against a source for this long appear under Verification."
            value={days}
            onChange={setDays}
            error={errors.staleAfterDays}
          />
        </div>
        <Button type="submit" disabled={save.isPending || days === String(saved.staleAfterDays)}>
          Save
        </Button>
        {save.isSuccess && <p role="status">Saved.</p>}
      </form>
    </Panel>
  );
}
