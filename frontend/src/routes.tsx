import { redirect, type RouteObject } from 'react-router';
import { adminRoutes } from './admin/routes';
import { AppLayout } from './layout/AppLayout';
import { CHECK_ELIGIBILITY_PATH } from './config/navigation';
import { ErrorPage } from './pages/ErrorPage';
import { HomePage } from './pages/HomePage';

/** Pages are code-split: each is only downloaded when visited, which keeps the first load small. */
const infoPage =
  (name: 'AboutPage' | 'DisclaimerPage' | 'ContactPage'): RouteObject['lazy'] =>
  async () => ({
    Component: (await import('./pages/InfoPages'))[name],
  });

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    // Shown while a code-split page loads on first visit, instead of a blank screen.
    hydrateFallbackElement: (
      <p role="status" className="p-8">
        Loading…
      </p>
    ),
    children: [
      { index: true, element: <HomePage /> },
      {
        path: CHECK_ELIGIBILITY_PATH.slice(1),
        lazy: async () => ({
          Component: (await import('./pages/CheckEligibilityPage')).CheckEligibilityPage,
        }),
      },
      {
        path: `${CHECK_ELIGIBILITY_PATH.slice(1)}/results`,
        lazy: async () => ({
          Component: (await import('./pages/EligibilityResultsPage')).EligibilityResultsPage,
        }),
      },
      {
        path: 'programmes/:id',
        lazy: async () => ({
          Component: (await import('./pages/ProgrammeDetailPage')).ProgrammeDetailPage,
        }),
      },
      // There is no programme browse page: programmes are listed on each university's page.
      { path: 'programmes', loader: () => redirect('/universities') },
      {
        path: 'universities',
        lazy: async () => ({
          Component: (await import('./pages/UniversitiesPage')).UniversitiesPage,
        }),
      },
      {
        path: 'universities/:slug',
        lazy: async () => ({
          Component: (await import('./pages/UniversityDetailPage')).UniversityDetailPage,
        }),
      },
      {
        path: 'scholarships',
        lazy: async () => ({
          Component: (await import('./pages/ScholarshipsPage')).ScholarshipsPage,
        }),
      },
      {
        path: 'scholarships/:slug',
        lazy: async () => ({
          Component: (await import('./pages/ScholarshipDetailPage')).ScholarshipDetailPage,
        }),
      },
      {
        path: 'mentors',
        lazy: async () => ({ Component: (await import('./pages/MentorsPage')).MentorsPage }),
      },
      {
        path: 'mentors/:slug',
        lazy: async () => ({
          Component: (await import('./pages/MentorProfilePage')).MentorProfilePage,
        }),
      },
      { path: 'about', lazy: infoPage('AboutPage') },
      { path: 'disclaimer', lazy: infoPage('DisclaimerPage') },
      { path: 'contact', lazy: infoPage('ContactPage') },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('./pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
  {
    errorElement: <ErrorPage />,
    hydrateFallbackElement: (
      <p role="status" className="p-8">
        Loading…
      </p>
    ),
    children: adminRoutes,
  },
];
