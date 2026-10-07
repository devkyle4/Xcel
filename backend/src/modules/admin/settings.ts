import { type PlatformSettings, SETTING_KEYS, settingsUpdateSchema } from '@xcel/shared';
import { Hono } from 'hono';
import type { Db } from '../../db/client';
import { appSettings } from '../../db/schema';
import { audited } from '../../lib/audit';
import type { AdminEnv } from '../../lib/auth/middleware';
import { parseJson } from '../../lib/http';
import { getSettings } from '../../lib/settings';

export function settingsAdminRoutes(db: () => Db) {
  return new Hono<AdminEnv>()
    .get('/', async (c) => c.json<PlatformSettings>(await getSettings(db())))
    .patch('/', async (c) => {
      const { staleAfterDays } = await parseJson(c, settingsUpdateSchema);
      const actorId = c.get('admin').user.id;
      const before = await getSettings(db());
      await audited(db(), actorId, async (tx, audit) => {
        await tx
          .insert(appSettings)
          .values({ key: SETTING_KEYS.staleAfterDays, value: staleAfterDays, updatedBy: actorId })
          .onConflictDoUpdate({
            target: appSettings.key,
            set: { value: staleAfterDays, updatedBy: actorId },
          });
        await audit({
          action: 'settings.update',
          entityType: 'settings',
          entityId: SETTING_KEYS.staleAfterDays,
          before,
          after: { staleAfterDays },
        });
      });
      return c.json<PlatformSettings>(await getSettings(db()));
    });
}
