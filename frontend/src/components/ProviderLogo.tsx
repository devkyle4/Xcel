import { useState } from 'react';

/** "Ghana Education Trust Fund" -> "GE". */
function initials(name: string) {
  return name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !['and', 'of', 'the', 'for'].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/**
 * A provider's logo in a fixed-size box, falling back to their initials when
 * there is no logo or it fails to load. Decorative: the provider's name is
 * always shown as text next to it.
 */
export function ProviderLogo({
  src,
  name,
  size = 'md',
}: {
  src: string | null;
  name: string;
  size?: 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const box = size === 'lg' ? 'h-20 w-44' : 'h-16 w-36';
  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        data-testid="logo-fallback"
        className={`${box} flex shrink-0 items-center justify-center rounded-md bg-blue-50 text-xl font-bold text-blue-950`}
      >
        {initials(name)}
      </div>
    );
  }
  return (
    <div
      className={`${box} flex shrink-0 items-center justify-center rounded-md border border-blue-100 bg-white p-1.5`}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
