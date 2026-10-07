import { Link } from 'react-router';
import { ELIGIBILITY_DISCLAIMER } from '../components/Disclaimer';
import { BRAND } from '../config/brand';

/** About, disclaimer and contact live here, not in the main navigation (SRS 11.4). */
export function Footer() {
  return (
    <footer className="mt-16 bg-blue-950 text-white [&_:focus-visible]:outline-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <p className="text-lg font-bold">{BRAND.name}</p>
          <p className="max-w-prose">{BRAND.tagline}</p>
          <p className="max-w-prose text-sm">{ELIGIBILITY_DISCLAIMER}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="space-y-2">
            {[
              { to: '/about', label: 'About' },
              { to: '/disclaimer', label: 'Disclaimer' },
              { to: '/contact', label: 'Contact' },
            ].map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="text-white underline-offset-4 hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-blue-900">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm">
          © {new Date().getFullYear()} {BRAND.name}
        </p>
      </div>
    </footer>
  );
}
