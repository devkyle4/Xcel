import type { ReactNode } from 'react';
import { pageTitle } from '../config/brand';

/** Standard page wrapper: sets the document title and the page's single h1. */
export function PageContainer({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <title>{pageTitle(title)}</title>
      <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
      {intro && <p className="mt-3 max-w-prose text-lg">{intro}</p>}
      {children && <div className="mt-8 space-y-6">{children}</div>}
    </div>
  );
}
