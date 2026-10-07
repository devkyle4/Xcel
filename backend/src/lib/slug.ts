import { slugify } from '@xcel/shared';
import { ValidationError } from './http';

/**
 * A slug for `name` that `isTaken` reports as free: "name", then "name-2",
 * "name-3", and so on.
 */
export async function uniqueSlug(
  name: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name);
  if (!base) {
    throw new ValidationError([
      { path: 'slug', message: 'Enter a slug; the name has no letters or numbers' },
    ]);
  }
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new ValidationError([{ path: 'slug', message: 'Could not find a free slug; enter one' }]);
}
