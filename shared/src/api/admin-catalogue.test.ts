import { describe, expect, it } from 'vitest';
import { REPORT_TRANSITIONS, SCHOLARSHIP_TRANSITIONS } from '../publishing';
import {
  gradeOrderSchema,
  reportCreateSchema,
  scholarshipCreateSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
} from './admin-catalogue';

describe('scholarship and report workflows', () => {
  it('lets expired scholarships be republished and archived ones restored as drafts', () => {
    expect(SCHOLARSHIP_TRANSITIONS.expired).toContain('published');
    expect(SCHOLARSHIP_TRANSITIONS.archived).toEqual(['draft']);
  });

  it('lets closed reports be reopened', () => {
    expect(REPORT_TRANSITIONS.resolved).toEqual(['open']);
    expect(REPORT_TRANSITIONS.dismissed).toEqual(['open']);
  });
});

describe('scholarshipCreateSchema', () => {
  it('trims and de-duplicates labels', () => {
    expect(
      scholarshipCreateSchema.parse({
        name: 'Merit Award',
        providerName: 'Fund',
        fields: [' Engineering ', 'Engineering', 'Medicine'],
      }).fields,
    ).toEqual(['Engineering', 'Medicine']);
  });
});

describe('subject schemas', () => {
  it('requires UPPER_SNAKE_CASE codes', () => {
    const subject = { name: 'Further Maths', category: 'elective' };
    expect(subjectCreateSchema.safeParse({ ...subject, code: 'FURTHER_MATHS' }).success).toBe(true);
    expect(subjectCreateSchema.safeParse({ ...subject, code: 'further-maths' }).success).toBe(
      false,
    );
  });

  it('never allows changing a code', () => {
    expect(subjectUpdateSchema.safeParse({ code: 'NEW_CODE' }).success).toBe(false);
  });
});

describe('gradeOrderSchema', () => {
  it('rejects duplicates', () => {
    expect(gradeOrderSchema.safeParse({ codes: ['A1', 'A1'] }).success).toBe(false);
  });
});

describe('reportCreateSchema', () => {
  const message = 'The deadline shown here is wrong.';

  it('identifies programmes by id and universities or scholarships by slug', () => {
    expect(
      reportCreateSchema.safeParse({
        entityType: 'programme',
        entityId: '00000000-0000-4000-8000-000000000000',
        message,
      }).success,
    ).toBe(true);
    expect(
      reportCreateSchema.safeParse({ entityType: 'scholarship', slug: 'merit-award', message })
        .success,
    ).toBe(true);
  });

  it('accepts no contact details', () => {
    expect(
      reportCreateSchema.safeParse({
        entityType: 'university',
        slug: 'ug',
        message,
        email: 'a@b.c',
      }).success,
    ).toBe(false);
  });

  it('requires a meaningful message', () => {
    expect(
      reportCreateSchema.safeParse({ entityType: 'university', slug: 'ug', message: 'wrong' })
        .success,
    ).toBe(false);
  });
});
