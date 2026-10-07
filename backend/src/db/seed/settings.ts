import { SETTING_KEYS } from '@xcel/shared';

/**
 * Default platform settings. Seeding never overwrites a value an
 * administrator has already changed.
 */
export const settingSeeds = [
  // OI-02 is unresolved; 365 days is a provisional default.
  { key: SETTING_KEYS.staleAfterDays, value: 365 },
];
