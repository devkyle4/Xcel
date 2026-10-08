import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BRAND } from '../../config/brand';

/** Admin page frame: document title, optional back link, the single h1 and header actions. */
export function AdminPage({
  title,
  back,
  actions,
  children,
}: {
  title: string;
  back?: { to: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <title>{`${title} – ${BRAND.name} admin`}</title>
      {back && (
        <Link to={back.to} className="inline-flex items-center gap-1 font-semibold">
          <ChevronLeft aria-hidden="true" className="size-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** White panel with a heading, for grouping sections of an admin page. */
export function Panel({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 rounded-lg border border-blue-100 bg-white p-4 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="text-xl font-bold">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
