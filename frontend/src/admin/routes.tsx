import type { RouteObject } from 'react-router';

/** Admin pages load on demand, so public visitors never download them. */
const page =
  <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M): RouteObject['lazy'] =>
  async () => ({ Component: (await load())[name] as React.ComponentType });

const pages = () => import('./pages');

export const adminRoutes: RouteObject[] = [
  { path: 'admin/login', lazy: page(pages, 'LoginPage') },
  {
    path: 'admin',
    lazy: async () => ({ Component: (await import('./AdminLayout')).AdminLayout }),
    children: [
      { index: true, lazy: page(pages, 'DashboardPage') },
      { path: 'universities', lazy: page(pages, 'UniversitiesPage') },
      { path: 'universities/new', lazy: page(pages, 'NewUniversityPage') },
      { path: 'universities/:id', lazy: page(pages, 'EditUniversityPage') },
      { path: 'programmes', lazy: page(pages, 'ProgrammesPage') },
      { path: 'programmes/new', lazy: page(pages, 'NewProgrammePage') },
      { path: 'programmes/:id', lazy: page(pages, 'EditProgrammePage') },
      { path: 'cycles/:id', lazy: page(pages, 'CyclePage') },
      { path: 'sources', lazy: page(pages, 'SourcesPage') },
      { path: 'sources/new', lazy: page(pages, 'NewSourcePage') },
      { path: 'sources/:id', lazy: page(pages, 'EditSourcePage') },
      { path: 'verification', lazy: page(pages, 'VerificationPage') },
      { path: 'scholarships', lazy: page(pages, 'ScholarshipsPage') },
      { path: 'scholarships/new', lazy: page(pages, 'NewScholarshipPage') },
      { path: 'scholarships/:id', lazy: page(pages, 'EditScholarshipPage') },
      { path: 'mentors', lazy: page(pages, 'MentorsPage') },
      { path: 'mentors/new', lazy: page(pages, 'NewMentorPage') },
      { path: 'mentors/:id', lazy: page(pages, 'EditMentorPage') },
      { path: 'subjects-grades', lazy: page(pages, 'AcademicPage') },
      { path: 'reports', lazy: page(pages, 'ReportsPage') },
      { path: 'audit-log', lazy: page(pages, 'AuditLogPage') },
      { path: 'settings', lazy: page(pages, 'SettingsPage') },
      { path: '*', lazy: page(pages, 'AdminNotFoundPage') },
    ],
  },
];
