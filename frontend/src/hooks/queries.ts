import {
  type AcademicCatalogue,
  type EligibilityBundle,
  type GradeInfo,
  indexCatalogue,
  type ProgrammeDetail,
  type SubjectInfo,
} from '@xcel/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiGet } from '../lib/api';

export const useSubjects = () =>
  useQuery({
    queryKey: ['subjects'],
    queryFn: () => apiGet<SubjectInfo[]>('/subjects'),
    staleTime: 10 * 60_000,
  });

export const useGrades = () =>
  useQuery({
    queryKey: ['grades'],
    queryFn: () => apiGet<GradeInfo[]>('/grades'),
    staleTime: 10 * 60_000,
  });

/** Subjects and grades as the engine's catalogue, or undefined while loading. */
export function useCatalogue() {
  const subjects = useSubjects();
  const grades = useGrades();
  const catalogue = useMemo<AcademicCatalogue | undefined>(
    () =>
      subjects.data && grades.data ? { subjects: subjects.data, grades: grades.data } : undefined,
    [subjects.data, grades.data],
  );
  const index = useMemo(() => catalogue && indexCatalogue(catalogue), [catalogue]);
  return {
    catalogue,
    index,
    isPending: subjects.isPending || grades.isPending,
    error: subjects.error ?? grades.error,
  };
}

/** Published requirements of every programme, for checking eligibility in the browser. */
export const useEligibilityBundle = () =>
  useQuery({
    queryKey: ['eligibility-bundle'],
    queryFn: () => apiGet<EligibilityBundle>('/eligibility/requirements'),
    staleTime: 5 * 60_000,
  });

export const useProgramme = (id: string, year: string | null) =>
  useQuery({
    queryKey: ['programme', id, year],
    queryFn: () => apiGet<ProgrammeDetail>(`/programmes/${id}`, { year }),
  });
