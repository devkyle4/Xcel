import type { SubjectCategory } from '../domain';
import type { AcademicCatalogue, CatalogueGrade, CatalogueSubject } from './types';

export interface CatalogueIndex {
  grade(code: string): CatalogueGrade | undefined;
  subject(code: string): CatalogueSubject | undefined;
  /** Display name for a subject, falling back to its code. */
  subjectName(code: string): string;
  /** Codes of all subjects, optionally limited to one category. */
  subjectCodes(category?: SubjectCategory | null): string[];
  /** True if `gradeCode` is `minGradeCode` or better. */
  meetsMinimum(gradeCode: string, minGradeCode: string): boolean;
}

export function indexCatalogue(catalogue: AcademicCatalogue): CatalogueIndex {
  const grades = new Map(catalogue.grades.map((g) => [g.code, g]));
  const subjects = new Map(catalogue.subjects.map((s) => [s.code, s]));

  const rankOf = (code: string) => {
    const grade = grades.get(code);
    if (!grade) throw new Error(`Unknown grade code: ${code}`);
    return grade.rank;
  };

  return {
    grade: (code) => grades.get(code),
    subject: (code) => subjects.get(code),
    subjectName: (code) => subjects.get(code)?.name ?? code,
    subjectCodes: (category) =>
      catalogue.subjects.filter((s) => !category || s.category === category).map((s) => s.code),
    meetsMinimum: (gradeCode, minGradeCode) => rankOf(gradeCode) <= rankOf(minGradeCode),
  };
}
