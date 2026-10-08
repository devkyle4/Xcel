import type { ReactNode } from 'react';
import { pageTitle } from '../config/brand';

/** Standard page wrapper: sets the document title and the page's single h1. */
export function PageContainer({
  title,
  intro,
  narrow = false,
  children,
}: {
  title: string;
  intro?: ReactNode;
  /** A centred, form-width column with a centred title, e.g. for results entry. */
  narrow?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`mx-auto px-4 py-10 ${narrow ? 'max-w-2xl' : 'max-w-6xl'}`}>
      <title>{pageTitle(title)}</title>
      <h1 className={`text-3xl font-bold md:text-4xl ${narrow ? 'text-center' : ''}`}>{title}</h1>
      {intro && (
        <p className={`mt-3 max-w-prose text-lg ${narrow ? 'mx-auto text-center' : ''}`}>{intro}</p>
      )}
      {children && <div className="mt-8 space-y-6">{children}</div>}
    </div>
  );
}
