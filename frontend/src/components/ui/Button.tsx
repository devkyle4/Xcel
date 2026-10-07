import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';

type Variant = 'primary' | 'secondary';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-base font-semibold no-underline transition-colors';

/** Primary: green call to action (Check Eligibility, Send request). Secondary: blue outline. */
const variants: Record<Variant, string> = {
  primary: 'bg-green-700 text-white hover:bg-green-800',
  secondary: 'border-2 border-blue-700 bg-white text-blue-700 hover:bg-blue-50',
};

function buttonClasses(variant: Variant = 'primary', extra = '') {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type="button" className={buttonClasses(variant, className)} {...props} />;
}

export function ButtonLink({
  to,
  variant = 'primary',
  className = '',
  children,
}: {
  to: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={buttonClasses(variant, className)}>
      {children}
    </Link>
  );
}
