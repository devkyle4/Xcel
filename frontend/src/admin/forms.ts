/** The part of a zod schema this needs, so the frontend does not depend on zod directly. */
interface Schema<T> {
  safeParse(
    value: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

/**
 * Checks input against the same shared schema the server uses, returning
 * field errors keyed by path ("" for errors that belong to no field).
 */
export function validate<T>(
  schema: Schema<T>,
  value: unknown,
): { data: T; errors?: undefined } | { data?: undefined; errors: Record<string, string> } {
  const result = schema.safeParse(value);
  if (result.success) return { data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues)
    errors[issue.path.map(String).join('.')] ??= issue.message;
  return { errors };
}

/** Text input value: empty for null. */
export const str = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

/** Optional form text: trimmed, with empty meaning "none". */
export const orNull = (value: string) => value.trim() || null;

/** Only the fields whose values differ from the saved record, for a PATCH. */
export function changedFields<T extends Record<string, unknown>>(
  saved: Record<string, unknown>,
  values: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(saved[key] ?? null),
    ),
  ) as Partial<T>;
}

/** Navigation state after a successful save; the unsaved-changes guard lets it through. */
export const SAVED = { saved: true } as const;

/** "Engineering, Health" for a list field edited as text. */
export const listText = (values: readonly string[] | null | undefined) => (values ?? []).join(', ');

/** Splits comma-separated text into trimmed, non-empty values. */
export const parseList = (text: string) =>
  text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
