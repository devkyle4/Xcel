import type { RouteObject } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { CHECK_ELIGIBILITY_PATH } from './config/navigation';
import { ErrorPage } from './pages/ErrorPage';
import { HomePage } from './pages/HomePage';

/** Code-split page: only downloaded when visited, which keeps the first load small. */
const comingSoon =
  (title: string, intro: string): RouteObject['lazy'] =>
  async () => {
    const { ComingSoonPage } = await import('./pages/ComingSoonPage');
    return { Component: () => <ComingSoonPage title={title} intro={intro} /> };
  };

const infoPage =
  (name: 'AboutPage' | 'DisclaimerPage' | 'ContactPage'): RouteObject['lazy'] =>
  async () => ({
    Component: (await import('./pages/InfoPages'))[name],
  });

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: CHECK_ELIGIBILITY_PATH.slice(1),
        lazy: comingSoon(
          'Check your eligibility',
          'Enter your WASSCE results to see which programmes match.',
        ),
      },
      {
        path: 'programmes',
        lazy: comingSoon(
          'Programmes',
          'Search university programmes and their admission requirements.',
        ),
      },
      {
        path: 'universities',
        lazy: comingSoon('Universities', 'Browse universities and the programmes they offer.'),
      },
      {
        path: 'scholarships',
        lazy: comingSoon('Scholarships', 'Find scholarships that are open now or opening soon.'),
      },
      {
        path: 'mentors',
        lazy: comingSoon('Find a Mentor', 'Request one-on-one guidance from a mentor.'),
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
];
