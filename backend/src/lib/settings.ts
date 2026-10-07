import { type PlatformSettings, SETTING_KEYS } from '@xcel/shared';
import { inArray } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { appSettings } from '../db/schema';

const DEFAULTS: PlatformSettings = { staleAfterDays: 365 };

export async function getSettings(db: Executor): Promise<PlatformSettings> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, Object.values(SETTING_KEYS)));
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const staleAfterDays = stored.get(SETTING_KEYS.staleAfterDays);
  return {
    staleAfterDays: typeof staleAfterDays === 'number' ? staleAfterDays : DEFAULTS.staleAfterDays,
  };
}
