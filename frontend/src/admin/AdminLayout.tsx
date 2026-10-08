import { useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BadgeCheck,
  Flag,
  History,
  ListOrdered,
  Settings,
  Users,
  BookOpen,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Navigate,
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from 'react-router';
import { Logo } from '../components/Logo';
import { ApiRequestError, apiSend } from '../lib/api';
import { ME_KEY, useAdminMe } from './api';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/universities', label: 'Universities', icon: Building2 },
  { to: '/admin/programmes', label: 'Programmes', icon: BookOpen },
  { to: '/admin/scholarships', label: 'Scholarships', icon: Award },
  { to: '/admin/mentors', label: 'Mentors', icon: Users },
  { to: '/admin/subjects-grades', label: 'Subjects and grades', icon: ListOrdered },
  { to: '/admin/sources', label: 'Sources', icon: FileText },
  { to: '/admin/verification', label: 'Verification', icon: BadgeCheck },
  { to: '/admin/reports', label: 'Error reports', icon: Flag },
  { to: '/admin/audit-log', label: 'Audit log', icon: History },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

/**
 * Signed-in admin area. The server authorizes every admin request; this
 * layout only decides what to show. If the session ends (any admin request
 * answers 401), it returns to the sign-in page.
 */
export function AdminLayout() {
  const me = useAdminMe();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        const error = event.query.state.error;
        if (
          event.type === 'updated' &&
          event.query.queryKey[0] === 'admin' &&
          error instanceof ApiRequestError &&
          error.status === 401
        ) {
          queryClient.setQueryData(ME_KEY, null);
        }
      }),
    [queryClient],
  );

  // Close the mobile menu after navigating.
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setMenuOpen(false);
  }

  if (me.isPending) {
    return (
      <p role="status" className="p-8">
        Loading…
      </p>
    );
  }
  if (me.error) {
    return (
      <p role="alert" className="p-8 text-red-800">
        The admin area could not be loaded. Check your connection and reload the page.
      </p>
    );
  }
  if (!me.data) {
    const next = location.pathname + location.search;
    return <Navigate to={`/admin/login?next=${encodeURIComponent(next)}`} replace />;
  }

  const signOut = async () => {
    await apiSend('POST', '/admin/auth/logout').catch(() => undefined);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'admin' });
    queryClient.setQueryData(ME_KEY, null);
    await navigate('/admin/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-off-white">
      <meta name="robots" content="noindex, nofollow" />
      <a
        href="#admin-main"
        className="sr-only z-50 rounded-md bg-white p-3 font-semibold focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <header className="bg-blue-950 text-white">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-1.5 hover:bg-blue-900 md:hidden"
              aria-expanded={menuOpen}
              aria-controls="admin-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X aria-hidden="true" className="size-6" />
              ) : (
                <Menu aria-hidden="true" className="size-6" />
              )}
              <span className="sr-only">Menu</span>
            </button>
            <Logo />
            <span className="rounded bg-blue-900 px-2 py-0.5 text-sm font-semibold">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm sm:inline">{me.data.name}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-semibold hover:bg-blue-900"
            >
              <LogOut aria-hidden="true" className="size-5" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <nav
          id="admin-nav"
          aria-label="Admin"
          className={`${menuOpen ? 'block' : 'hidden'} w-full shrink-0 border-r border-blue-100 bg-white md:block md:w-56`}
        >
          <ul className="space-y-1 p-3">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2 font-semibold no-underline ${
                      isActive ? 'bg-blue-100 text-blue-950' : 'text-blue-950 hover:bg-blue-50'
                    }`
                  }
                >
                  <Icon aria-hidden="true" className="size-5" /> {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main
          id="admin-main"
          tabIndex={-1}
          className={`${menuOpen ? 'hidden' : 'block'} min-w-0 flex-1 focus:outline-none md:block`}
        >
          <Outlet />
        </main>
      </div>
      <ScrollRestoration />
    </div>
  );
}
