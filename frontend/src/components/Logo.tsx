import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router';
import { BRAND } from '../config/brand';

/** The logo links home; there is no separate Home link (SRS 11.4). */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 text-xl font-bold text-white no-underline ${className}`}
    >
      <GraduationCap aria-hidden="true" className="size-7" />
      {BRAND.name}
      <span className="sr-only"> – home</span>
    </Link>
  );
}
