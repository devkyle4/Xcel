import { useState } from 'react';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** Mentor photo, or their initials. Decorative: the name is always shown next to it. */
export function MentorAvatar({
  src,
  name,
  size = 'md',
}: {
  src: string | null;
  name: string;
  size?: 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const box = size === 'lg' ? 'size-28 text-3xl' : 'size-16 text-xl';
  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className={`${box} flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-900`}
      >
        {initials(name)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className={`${box} shrink-0 rounded-full object-cover`}
    />
  );
}
