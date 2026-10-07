import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import { ButtonLink } from '../components/ui/Button';
import { Logo } from '../components/Logo';
import { CHECK_ELIGIBILITY_PATH, NAV_LINKS } from '../config/navigation';

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 font-medium text-white no-underline hover:bg-blue-900 ${
    isActive ? 'underline decoration-2 underline-offset-8' : ''
  }`;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Escape closes the mobile menu and returns focus to its button.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const links = (onNavigate?: () => void) =>
    NAV_LINKS.map(({ to, label }) => (
      <li key={to}>
        <NavLink to={to} className={linkClasses} onClick={onNavigate}>
          {label}
        </NavLink>
      </li>
    ));

  return (
    // White focus rings: blue-700 is not visible enough on blue-950.
    <header className="bg-blue-950 text-white [&_:focus-visible]:outline-white">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Logo />
        <ul className="ml-auto hidden items-center gap-1 md:flex">{links()}</ul>
        {/* Always visible, including on mobile where the other links collapse. */}
        <ButtonLink
          to={CHECK_ELIGIBILITY_PATH}
          className="ml-auto px-3 py-2 text-sm sm:text-base md:ml-2"
        >
          Check Eligibility
        </ButtonLink>
        <button
          ref={toggleRef}
          type="button"
          className="rounded-md p-2 text-white hover:bg-blue-900 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X aria-hidden="true" className="size-6" />
          ) : (
            <Menu aria-hidden="true" className="size-6" />
          )}
          <span className="sr-only">Menu</span>
        </button>
      </nav>
      {open && (
        <div id="mobile-menu" className="border-t border-blue-900 md:hidden">
          <ul className="mx-auto max-w-6xl space-y-1 px-4 py-3">{links(() => setOpen(false))}</ul>
        </div>
      )}
    </header>
  );
}
