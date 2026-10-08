import { ExternalLink } from 'lucide-react';

/** Link to an official website, opening in a new tab. Secondary style: green is reserved for the main calls to action. */
export function ExternalLinkButton({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border-2 border-blue-700 bg-white px-4 py-2 font-semibold no-underline hover:bg-blue-50"
    >
      {children}
      <ExternalLink aria-hidden="true" className="size-4" />{' '}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
