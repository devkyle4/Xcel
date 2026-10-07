import { describe, expect, it } from 'vitest';
import {
  programmeUpdateSchema,
  universityCreateSchema,
  universityUpdateSchema,
  verificationCreateSchema,
} from './admin-content';

const university = { name: 'University of Ghana', institutionType: 'public_university' };

describe('admin input schemas', () => {
  it('accepts a minimal university and normalises blank text to null', () => {
    expect(universityCreateSchema.parse({ ...university, town: '  ' })).toMatchObject({
      name: 'University of Ghana',
      town: null,
    });
  });

  it.each(['javascript:alert(1)', 'ftp://example.com', 'example.com'])(
    'rejects the URL %s',
    (websiteUrl) => {
      expect(universityCreateSchema.safeParse({ ...university, websiteUrl }).success).toBe(false);
    },
  );

  it('rejects unknown fields so typos are not silently ignored', () => {
    expect(universityCreateSchema.safeParse({ ...university, staus: 'published' }).success).toBe(
      false,
    );
  });

  it('does not allow changing status through an ordinary update', () => {
    expect(universityUpdateSchema.safeParse({ status: 'published' }).success).toBe(false);
  });

  it('distinguishes leaving a field unchanged from clearing it', () => {
    expect(universityUpdateSchema.parse({ town: null })).toEqual({ town: null });
    expect(universityUpdateSchema.parse({ name: 'UG' + 'x' })).not.toHaveProperty('town');
    expect(universityUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('does not allow moving a programme to another university', () => {
    expect(
      programmeUpdateSchema.safeParse({ universityId: '00000000-0000-0000-0000-000000000000' })
        .success,
    ).toBe(false);
  });

  it('requires a source for a verified record', () => {
    const base = { entityType: 'university', entityId: '00000000-0000-4000-8000-000000000000' };
    expect(verificationCreateSchema.safeParse({ ...base, status: 'verified' }).success).toBe(false);
    expect(verificationCreateSchema.safeParse({ ...base, status: 'pending' }).success).toBe(true);
  });
});
