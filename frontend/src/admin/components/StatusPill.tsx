import type { LucideIcon } from 'lucide-react';

const TONES = {
  neutral: 'border-blue-300 bg-white text-blue-950',
  info: 'border-blue-300 bg-blue-50 text-blue-900',
  good: 'border-green-300 bg-green-100 text-green-900',
  muted: 'border-blue-100 bg-off-white text-blue-950',
  // Only for negative states, such as an expired scholarship.
  negative: 'border-red-300 bg-red-50 text-red-800',
} as const;

/** A status with an icon and a text label, so colour is never the only signal. */
export function StatusPill({
  label,
  Icon,
  tone,
}: {
  label: string;
  Icon: LucideIcon;
  tone: keyof typeof TONES;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </span>
  );
}
