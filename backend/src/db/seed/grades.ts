import type { grades } from '../schema';

type GradeSeed = Omit<typeof grades.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;

/** WASSCE grading scale. Rank 1 is best; A1–C6 are credit passes, D7–E8 passes, F9 fail. */
export const gradeSeeds: GradeSeed[] = [
  { code: 'A1', label: 'Excellent', rank: 1, points: 1, isPass: true },
  { code: 'B2', label: 'Very Good', rank: 2, points: 2, isPass: true },
  { code: 'B3', label: 'Good', rank: 3, points: 3, isPass: true },
  { code: 'C4', label: 'Credit', rank: 4, points: 4, isPass: true },
  { code: 'C5', label: 'Credit', rank: 5, points: 5, isPass: true },
  { code: 'C6', label: 'Credit', rank: 6, points: 6, isPass: true },
  { code: 'D7', label: 'Pass', rank: 7, points: 7, isPass: true },
  { code: 'E8', label: 'Pass', rank: 8, points: 8, isPass: true },
  { code: 'F9', label: 'Fail', rank: 9, points: 9, isPass: false },
];
