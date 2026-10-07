import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

/** Information panel on a blue-50 or green-50 background. Never red: red is for errors only. */
export function InfoPanel({
  tone = 'blue',
  title,
  children,
}: {
  tone?: 'blue' | 'green';
  title?: string;
  children: ReactNode;
}) {
  const colours = tone === 'blue' ? 'bg-blue-50 border-blue-300' : 'bg-green-50 border-green-300';
  return (
    <aside className={`flex gap-3 rounded-lg border p-4 ${colours}`}>
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-700" />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </aside>
  );
}
