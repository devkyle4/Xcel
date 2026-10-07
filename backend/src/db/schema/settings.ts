import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';
import { users } from './users';

/** Admin-editable platform settings, keyed by SETTING_KEYS in the shared package. */
export const appSettings = pgTable('app_settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
});
